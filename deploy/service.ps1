# deploy/service.ps1 - the ONE supervision script for the study box.
#
# Verbs:
#   install    legacy teardown + pinned nginx download (SHA256-verified) + 5 Scheduled
#              Tasks registered as the CURRENT USER (S4U, Limited -- never SYSTEM, so any
#              user shell can kill any component; the 2026-11-03 zombie was SYSTEM-owned).
#              Hard-requires elevation; NO silent non-admin fallback (that fallback is
#              what created dual supervision). -DryRun prints every action, changes nothing.
#              -WithFirewall also runs the firewall verb.
#   remove     unregister the 5 tasks. -ResetFunnel also runs `tailscale funnel reset`.
#   verify     the zombie detector. Exit 0 healthy / 1 stale-or-down (safe to restart) /
#              2 structural anomaly (alert only, never restart-loop). Logs deploy\logs\verify.log.
#   watchdog   the 5-min tick (single supervision loop; replaces keepalive.ps1's loop+mutex):
#              verify; healthy -> heartbeat ping + public-path check (funnel reset on two
#              consecutive public failures); exit 1 -> restart via start.ps1 and re-verify;
#              exit 2 -> log loudly and DO NOT restart.
#   firewall   the firewall baseline (was deploy\firewall.ps1, folded in unchanged in
#              substance). Preview: service.ps1 firewall -WhatIf. Undo: -Revert.
#   status     read-only: tasks, listeners on 3000/8080/8081 WITH owning user (a foreign-
#              context listener becomes VISIBLE), funnel, last verify, last backup.
#
# Chain: Tailscale funnel (TLS, unchanged ts.net URL) -> nginx 127.0.0.1:8081 ->
#        { /api/* -> uvicorn :8080 ; /_next/static/* -> disk ; * -> next :3000 }.
#
# PS 5.1 only. ASCII only (+ UTF-8 BOM). Invoke-WebRequest always -UseBasicParsing.

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('install', 'remove', 'verify', 'watchdog', 'firewall', 'status')]
    [string]$Verb,
    [switch]$Revert,
    [switch]$WithFirewall,
    [switch]$DryRun,
    [switch]$ResetFunnel
)

$ErrorActionPreference = 'Stop'
$Root    = Split-Path -Parent $PSScriptRoot
$LogsDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

# Pinned nginx. Hash computed locally over the nginx.org HTTPS download; the same
# value is committed in deploy\nginx.sha256 as a drift guard.
$NginxVersion = '1.30.6'
$NginxSha256  = 'c6ee35edb0a861063323f709192ae50d1eefaf2ea7d00678bd2b22d8542dc61e'
$NginxDir     = Join-Path $PSScriptRoot 'tools\nginx'

$TaskNames  = @('COMPGame-Boot', 'COMPGame-Watchdog', 'COMPGame-Backup', 'COMPGame-Checks', 'COMPGame-Decks')
$LegacyTask = 'COMPGame-Heartbeat'   # dead-man's switch is folded into the watchdog tick

function Info([string]$m) { Write-Host $m }
function Warn([string]$m) { Write-Host $m -ForegroundColor Yellow }
function Err ([string]$m) { Write-Host $m -ForegroundColor Red }

function Log-Line([string]$file, [string]$m) {
    ((Get-Date).ToString('s') + '  ' + $m) | Add-Content -Path $file -Encoding utf8
}

function Test-Elevated {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Read-EnvLocal([string]$key) {
    $envFile = Join-Path $PSScriptRoot '.env.local'
    if (-not (Test-Path $envFile)) { return $null }
    $line = Get-Content $envFile | Where-Object { $_ -match ('^\s*' + [regex]::Escape($key) + '\s*=') } | Select-Object -First 1
    if (-not $line) { return $null }
    [void]($line -match '=(.+)$')
    return $Matches[1].Trim().Trim('"').Trim("'")
}

function Get-OwnerName([int]$procId) {
    try {
        # Invoke-CimMethod, NOT a direct .GetOwner() on the CimInstance: the PS adapter
        # exposes no such method, so the direct call ALWAYS threw and status cried
        # "zombie signature" on every healthy, own-user process (found 2026-11-04).
        $o = Invoke-CimMethod -InputObject (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $procId) -ErrorAction Stop) `
            -MethodName GetOwner -ErrorAction Stop
        $who = ($o.Domain + '\' + $o.User)
        # Cross-session queries return EMPTY strings, not an error: our own S4U
        # task's processes show as a bare "\" (measured 2026-11-04 after a Boot-
        # task start). That is OUR stack, not a zombie -- say so.
        if ($who -eq '\') { return '(same user, other session -- the S4U task)' }
        return $who
    } catch {
        return 'ACCESS DENIED (foreign context -- the zombie signature)'
    }
}

# --------------------------------------------------------------------- verify
function Invoke-Verify {
    $log  = Join-Path $LogsDir 'verify.log'
    $base = 'http://127.0.0.1:8081'
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/login') -TimeoutSec 20
    } catch {
        Log-Line $log ('FAIL step1 front door down: ' + $_.Exception.Message)
        return 1
    }
    $m = [regex]::Match($resp.Content, '/_next/static/chunks/webpack-([a-f0-9]+)\.js')
    if (-not $m.Success) {
        Log-Line $log 'FAIL step2 no webpack hash in served HTML -- STRUCTURAL (Next renamed the chunk?); not restartable, needs a human'
        return 2
    }
    $hash = $m.Groups[1].Value
    $chunkPath = Join-Path $Root ('frontend\.next\static\chunks\webpack-' + $hash + '.js')
    if (-not (Test-Path $chunkPath)) {
        Log-Line $log ('FAIL step3 served hash ' + $hash + ' not on disk -- a stale process is answering (the zombie)')
        return 1
    }
    try {
        $r2 = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/_next/static/chunks/webpack-' + $hash + '.js') -TimeoutSec 20
        if ($r2.StatusCode -ne 200) { throw ('status ' + $r2.StatusCode) }
    } catch {
        Log-Line $log ('FAIL step4 static chunk through nginx: ' + $_.Exception.Message)
        return 1
    }
    try {
        $r3 = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/api/health') -TimeoutSec 20
        if ($r3.Content -notmatch '"ok"') {
            $snippet = $r3.Content
            if ($snippet.Length -gt 120) { $snippet = $snippet.Substring(0, 120) }
            throw ('unexpected body: ' + $snippet)
        }
    } catch {
        Log-Line $log ('FAIL step5 api leg through nginx: ' + $_.Exception.Message)
        return 1
    }
    Log-Line $log ('OK hash=' + $hash)
    return 0
}

# ------------------------------------------------------------- public path
# Lifted from keepalive.ps1 (Public-Status): resolve the funnel name against
# 1.1.1.1 (the tailnet resolver can lie), then probe each relay IP directly.
function Public-Status {
    try {
        $h = ((& tailscale status --json | ConvertFrom-Json).Self.DNSName).TrimEnd(".")
        $ips = @((Resolve-DnsName $h -Server 1.1.1.1 -Type A -ErrorAction Stop | Where-Object { $_.IPAddress }).IPAddress)
        if (-not $h -or -not $ips.Count) { return "unknown" }
        $last = "000"
        foreach ($ip in $ips) {
            $last = (& curl.exe -s -o NUL -w "%{http_code}" -m 20 --resolve "${h}:443:$ip" "https://$h/api/health")
            if ($last -eq "200") { return "200" }
        }
        return $last
    } catch { return "unknown" }
}

# -------------------------------------------------------------------- watchdog
function Invoke-Watchdog {
    $log  = Join-Path $LogsDir 'watchdog.log'
    $code = Invoke-Verify
    if ($code -eq 0) {
        # dead-man's switch: silence is the alert, so ping only while healthy.
        $hb = Read-EnvLocal 'HEARTBEAT_URL'
        if ($hb) {
            try { Invoke-WebRequest -UseBasicParsing -Uri $hb -TimeoutSec 15 | Out-Null }
            catch { Log-Line $log ('heartbeat ping failed: ' + $_.Exception.Message) }
        }
        # public path (the funnel can die while loopback is fine)
        $pub = Public-Status
        $stateFile = Join-Path $LogsDir '.public-fails'
        if ($pub -eq '200' -or $pub -eq 'unknown') {
            Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
            return
        }
        $fails = 1
        if (Test-Path $stateFile) {
            $prev = 0
            [void][int]::TryParse((Get-Content $stateFile -Raw).Trim(), [ref]$prev)
            $fails = $prev + 1
        }
        Set-Content -Path $stateFile -Value $fails -Encoding ascii
        Log-Line $log ('public path FAIL http=' + $pub + ' (consecutive: ' + $fails + ')')
        if ($fails -ge 2) {
            Log-Line $log 'two consecutive public failures -> tailscale funnel reset + --bg 8081'
            # cmd /c, not 2>&1 in PowerShell: same EAP=Stop native-stderr landmine
            # as the nginx -v probe below -- tailscale writes warnings to stderr.
            cmd /c "tailscale funnel reset 2>&1" | Out-Null
            cmd /c "tailscale funnel --bg 8081 2>&1" | Out-Null
            Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
        }
        return
    }
    if ($code -eq 1) {
        Log-Line $log 'verify failed (down or stale) -> restarting via start.ps1'
        $startPs1 = Join-Path $PSScriptRoot 'start.ps1'
        # Start-Process + WaitForExit + touch Handle: the PS-Run pattern from update.ps1.
        # Piping the child breaks because the servers it spawns inherit the pipe.
        $p = Start-Process -FilePath 'powershell.exe' `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ('"' + $startPs1 + '"')) `
            -NoNewWindow -PassThru
        $p.WaitForExit()
        $null = $p.Handle
        Log-Line $log ('start.ps1 exit ' + $p.ExitCode)
        $code2 = Invoke-Verify
        if ($code2 -eq 0) { Log-Line $log 'recovered'; return }
        # A failed recovery MUST NOT look like a healthy tick: nonzero exit so a
        # Scheduled Task's LastTaskResult shows it, and no heartbeat ping.
        Log-Line $log ('STILL DOWN after restart (verify=' + $code2 + '); no heartbeat ping -- silence is the alert')
        exit 1
    }
    Log-Line $log 'STRUCTURAL anomaly (verify exit 2) -- NOT restarting (flapping forbidden); no heartbeat ping'
    exit 2
}

# ------------------------------------------------------------------- firewall
# Folded in from deploy\firewall.ps1 (deleted). Tailscale-adapter lockout guard,
# allow-before-deny ordering, third-party inbound allows disabled and recorded in
# .firewall-state.json, default-deny LAST. -WhatIf previews; -Revert undoes.
function Invoke-Firewall {
    if (-not (Test-Elevated) -and -not $WhatIfPreference) {
        Err 'firewall must run from an ELEVATED PowerShell (preview with -WhatIf works unelevated).'
        exit 1
    }
    $Prefix    = 'COMPGame-'
    $StateFile = Join-Path $PSScriptRoot '.firewall-state.json'
    # Third-party allow rules whose DisplayName contains these are managed by their
    # own installers and are never disabled by the cleanup pass.
    $KeepThirdParty = @('Tailscale', 'Parsec')

    function Get-OurRules {
        Get-NetFirewallRule -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like ($Prefix + '*') }
    }
    function Remove-OurRule([string]$DisplayName) {
        $r = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
        if ($null -ne $r -and $PSCmdlet.ShouldProcess($DisplayName, 'Remove-NetFirewallRule (replace)')) {
            $r | Remove-NetFirewallRule
        }
    }

    if ($Revert) {
        foreach ($r in Get-OurRules) {
            if ($PSCmdlet.ShouldProcess($r.DisplayName, 'Remove-NetFirewallRule')) {
                $r | Remove-NetFirewallRule
            }
        }
        if (Test-Path $StateFile) {
            $state = Get-Content $StateFile -Raw | ConvertFrom-Json
            foreach ($name in @($state.disabled)) {
                $rule = Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
                if ($null -ne $rule -and $PSCmdlet.ShouldProcess($name, 'Enable-NetFirewallRule')) {
                    $rule | Enable-NetFirewallRule
                }
            }
            Remove-Item $StateFile -Force -Confirm:$false
        }
        if ($PSCmdlet.ShouldProcess('All profiles', 'Restore inbound default to NotConfigured')) {
            Set-NetFirewallProfile -Profile Domain, Public, Private -DefaultInboundAction NotConfigured
        }
        Write-Output 'Revert complete.'
        return
    }

    # --- Guard: never cut the branch we are sitting on -------------------------
    $ts = Get-NetAdapter -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceDescription -like '*Tailscale*' -or $_.Name -like '*Tailscale*' } |
        Select-Object -First 1
    if ($null -eq $ts) {
        throw 'No Tailscale adapter found. Bring Tailscale up first; aborting so default-deny cannot lock out remote administration.'
    }

    # --- Allow rules (created BEFORE default-deny) -----------------------------
    Remove-OurRule ($Prefix + 'Tailscale-Inbound')
    if ($PSCmdlet.ShouldProcess($Prefix + 'Tailscale-Inbound', 'New-NetFirewallRule')) {
        New-NetFirewallRule -DisplayName ($Prefix + 'Tailscale-Inbound') `
            -Direction Inbound -Action Allow -InterfaceAlias $ts.Name `
            -Description 'Management plane: inbound from the tailnet only.' | Out-Null
    }

    # Parsec host needs inbound UDP for direct peer traffic. Kept explicit so the
    # default-deny profile cannot silently sever remote administration.
    # Service is registered as 'Parsec' on some installs and 'parsecd' (the daemon
    # process name) on others -- accept either. Caught 2026-11-04 by the -WhatIf
    # checkpoint: a box with Parsec Running reported "parsecd not present".
    $parsecSvc = Get-CimInstance Win32_Service -Filter "Name='parsecd' OR Name='Parsec'" -ErrorAction SilentlyContinue
    if ($null -ne $parsecSvc) {
        Remove-OurRule ($Prefix + 'Parsec-UDP-Inbound')
        if ($PSCmdlet.ShouldProcess($Prefix + 'Parsec-UDP-Inbound', 'New-NetFirewallRule')) {
            New-NetFirewallRule -DisplayName ($Prefix + 'Parsec-UDP-Inbound') `
                -Direction Inbound -Action Allow -Protocol UDP -LocalPort 49001-49010 `
                -Description 'Parsec host peer traffic. Delete this rule if Parsec is removed.' | Out-Null
        }
    }
    else {
        Write-Output 'parsecd not present; skipping the Parsec allow rule.'
    }

    # --- Disable third-party inbound allow rules (recorded for -Revert) --------
    # Built-in Windows rules carry resource-string groups ("@FirewallAPI.dll,..."); left alone.
    $thirdParty = @()
    Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue | ForEach-Object {
        $rule = $_
        if ($rule.DisplayName -like ($Prefix + '*')) { return }
        if (-not [string]::IsNullOrEmpty($rule.Group) -and $rule.Group -like '@*') { return }
        foreach ($keep in $KeepThirdParty) {
            if ($rule.DisplayName -like ('*' + $keep + '*')) { return }
        }
        $thirdParty += $rule
    }
    # WhatIf must be useful HEADLESS too: ShouldProcess "What if" lines are host-UI
    # writes that bypass *> redirection, and $disabled stays empty under WhatIf, so
    # a captured log of a WhatIf run used to say "disabled: 0" and nothing else
    # (measured 2026-11-04 -- and run-deploy.ps1's APPLY gate reads exactly that log).
    # Spell out the would-be actions on the output stream as well.
    if ($WhatIfPreference) {
        Write-Output ('[whatif] would create inbound allow: ' + $Prefix + 'Tailscale-Inbound (interface ' + $ts.Name + ')')
        if ($null -ne $parsecSvc) { Write-Output ('[whatif] would create inbound allow: ' + $Prefix + 'Parsec-UDP-Inbound') }
        foreach ($rule in $thirdParty) {
            Write-Output ('[whatif] would DISABLE inbound allow: ' + $rule.DisplayName + ' [' + $rule.Name + ']')
        }
        Write-Output '[whatif] would set inbound default-deny on Domain,Public,Private (outbound stays allow)'
    }
    $disabled = @()
    foreach ($rule in $thirdParty) {
        if ($PSCmdlet.ShouldProcess($rule.DisplayName + ' [' + $rule.Name + ']', 'Disable-NetFirewallRule')) {
            $rule | Disable-NetFirewallRule
            $disabled += $rule.Name
        }
    }
    if (-not $WhatIfPreference) {
        [pscustomobject]@{ applied = (Get-Date).ToString('s'); disabled = $disabled } |
            ConvertTo-Json | Set-Content -Path $StateFile -Encoding ascii
    }

    # --- Default-deny LAST, and only if the Tailscale allow rule really exists --
    $guard = Get-NetFirewallRule -DisplayName ($Prefix + 'Tailscale-Inbound') -ErrorAction SilentlyContinue
    if ($null -eq $guard -and -not $WhatIfPreference) {
        throw 'Tailscale allow rule missing after creation; refusing to enable default-deny (lockout guard).'
    }
    if ($PSCmdlet.ShouldProcess('Domain,Public,Private profiles', 'Inbound Block / outbound Allow')) {
        Set-NetFirewallProfile -Profile Domain, Public, Private -Enabled True `
            -DefaultInboundAction Block -DefaultOutboundAction Allow
    }
    Write-Output ('Done. COMPGame rules present: ' + @((Get-OurRules)).Count +
        '; third-party inbound allows disabled: ' +
        $(if ($WhatIfPreference) { '' + @($thirdParty).Count + ' (would-be)' } else { $disabled.Count }))
}

# -------------------------------------------------------------------- install
function Invoke-Install {
    if ($DryRun) {
        Info '[dry-run] printing every intended action; changing NOTHING'
    } elseif (-not (Test-Elevated)) {
        Err 'install must run from an ELEVATED PowerShell (Scheduled Task registration needs admin).'
        Err 'There is deliberately no non-admin fallback -- the old Startup-folder fallback created the dual supervision behind the 2026-11-03 zombie incident.'
        exit 1
    }

    Info '--- 1. legacy teardown ---'
    foreach ($t in ($TaskNames + $LegacyTask)) {
        if ($DryRun) { Info ('[dry-run] would unregister task ' + $t + ' (if present)'); continue }
        if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $t -Confirm:$false
            Info ('unregistered old task ' + $t)
        }
    }
    $startupCmd = Join-Path ([Environment]::GetFolderPath('Startup')) 'COMPGame-keepalive.cmd'
    if ($DryRun) { Info ('[dry-run] would delete ' + $startupCmd + ' (if present)') }
    elseif (Test-Path $startupCmd) { Remove-Item $startupCmd -Force; Info ('deleted ' + $startupCmd) }
    $kl = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like '*keepalive.ps1*' })
    foreach ($proc in $kl) {
        if ($DryRun) { Info ('[dry-run] would kill running keepalive.ps1 PID ' + $proc.ProcessId); continue }
        Stop-Process -Id $proc.ProcessId -Force
        Info ('killed running keepalive.ps1 PID ' + $proc.ProcessId)
    }
    foreach ($gen in @('watchdog.ps1', 'heartbeat.ps1')) {
        $gp = Join-Path $PSScriptRoot $gen
        if ($DryRun) { Info ('[dry-run] would delete generated deploy\' + $gen + ' (if present)'); continue }
        if (Test-Path $gp) { Remove-Item $gp -Force; Info ('deleted generated deploy\' + $gen) }
    }

    Info '--- 2. nginx (pinned, hash-verified) ---'
    $pinFile = Join-Path $PSScriptRoot 'nginx.sha256'
    if (Test-Path $pinFile) {
        $pin = ((Get-Content $pinFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
        if ($pin -ne $NginxSha256) {
            Err ('deploy\nginx.sha256 drifted from the in-script pin (' + $pin + ' vs ' + $NginxSha256 + '). Aborting.')
            exit 1
        }
    }
    $nginxExe = Join-Path $NginxDir 'nginx.exe'
    $have = $false
    if (Test-Path $nginxExe) {
        # PS 5.1 landmine: with $ErrorActionPreference='Stop', a native command's
        # stderr merged via 2>&1 becomes a TERMINATING NativeCommandError -- and
        # nginx -v writes its version to stderr. This exact line made install
        # non-idempotent: fine from-zero (no exe yet, block skipped), dead on
        # re-run (found on dev 2026-11-04). cmd /c merges stderr INSIDE cmd, so
        # PowerShell only ever sees stdout.
        $v = (cmd /c "`"$nginxExe`" -v 2>&1") | Out-String
        if ($v -match [regex]::Escape('nginx/' + $NginxVersion)) { $have = $true; Info ('nginx ' + $NginxVersion + ' already present at ' + $NginxDir) }
    }
    if (-not $have) {
        $url = 'https://nginx.org/download/nginx-' + $NginxVersion + '.zip'
        if ($DryRun) {
            Info ('[dry-run] would download ' + $url)
            Info ('[dry-run] would require SHA256 ' + $NginxSha256 + ' and ABORT on mismatch')
            Info ('[dry-run] would expand to ' + $NginxDir)
        } else {
            $zip = Join-Path $env:TEMP ('nginx-' + $NginxVersion + '.zip')
            Info ('downloading ' + $url)
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip -TimeoutSec 180
            $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($hash -ne $NginxSha256) {
                Remove-Item $zip -Force -ErrorAction SilentlyContinue
                Err ('SHA256 MISMATCH: got ' + $hash + ', expected ' + $NginxSha256 + '. Aborting; never run an unverified binary.')
                exit 1
            }
            Info 'hash verified against the pin'
            $stage = Join-Path $env:TEMP ('nginx-stage-' + [guid]::NewGuid().ToString('n'))
            Expand-Archive -Path $zip -DestinationPath $stage -Force
            $inner = Join-Path $stage ('nginx-' + $NginxVersion)
            if (Test-Path $NginxDir) { Remove-Item $NginxDir -Recurse -Force }
            New-Item -ItemType Directory -Force -Path (Split-Path $NginxDir) | Out-Null
            Move-Item $inner $NginxDir
            Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item $zip -Force -ErrorAction SilentlyContinue
            Info ('installed nginx to ' + $NginxDir)
        }
    }

    Info '--- 3. scheduled tasks (current user, S4U, Limited -- never SYSTEM) ---'
    $taskUser  = $env:USERNAME
    $principal = New-ScheduledTaskPrincipal -UserId $taskUser -LogonType S4U -RunLevel Limited

    function Register-CompTask([string]$name, [string]$script, [string]$extraArgs, $trigger) {
        if ($DryRun) {
            $when = ($trigger | Out-String).Trim() -replace '\s+', ' '
            Info ('[dry-run] would register ' + $name + ' as ' + $taskUser + ' (S4U/Limited) -> powershell -File "' + $script + '" ' + $extraArgs)
            return
        }
        if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $name -Confirm:$false
        }
        $actArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '"'
        if ($extraArgs) { $actArgs += ' ' + $extraArgs }
        $action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $actArgs
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
            -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
        Info ('registered ' + $name + ' as ' + $taskUser + ' (S4U, Limited)')
    }

    $tBoot = New-ScheduledTaskTrigger -AtStartup
    # PS 5.1: a -Once trigger's Repetition is NOT writable after the fact
    # ($t.Repetition.Interval = ... throws PropertyNotFound). Repetition must be
    # set at construction, and -RepetitionDuration is then mandatory.
    $tWatch = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
    $tBackup = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
        -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
    $tChecks = New-ScheduledTaskTrigger -Daily -At '6:00AM'
    $tDecks  = New-ScheduledTaskTrigger -Daily -At '5:00AM'

    Register-CompTask 'COMPGame-Boot'     (Join-Path $PSScriptRoot 'start.ps1')        ''         $tBoot
    Register-CompTask 'COMPGame-Watchdog' $PSCommandPath                               'watchdog' $tWatch
    Register-CompTask 'COMPGame-Backup'   (Join-Path $PSScriptRoot 'backup.ps1')       ''         $tBackup
    Register-CompTask 'COMPGame-Checks'   (Join-Path $PSScriptRoot 'daily-checks.ps1') ''         $tChecks
    Register-CompTask 'COMPGame-Decks'    (Join-Path $PSScriptRoot 'make-decks.ps1')   ''         $tDecks

    if ($WithFirewall) {
        Info '--- 4. firewall baseline ---'
        if ($DryRun) { Info '[dry-run] would run the firewall verb' }
        else { Invoke-Firewall }
    }

    if ($DryRun) { Info '[dry-run] would run verify at the end' }
    else {
        $code = Invoke-Verify
        if ($code -eq 0) { Info 'verify: OK' }
        else { Warn ('verify exit ' + $code + ' -- expected if the stack is not running yet; deploy\start.ps1 next, then verify again') }
    }
    Info 'Done. Undo: deploy\service.ps1 remove'
}

# --------------------------------------------------------------------- remove
function Invoke-Remove {
    if (-not (Test-Elevated)) { Err 'remove must run from an ELEVATED PowerShell.'; exit 1 }
    foreach ($t in $TaskNames) {
        if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $t -Confirm:$false
            Info ('unregistered ' + $t)
        }
    }
    if ($ResetFunnel) { cmd /c "tailscale funnel reset 2>&1" | Out-Null; Info 'funnel reset' }
    Info 'Removed. nginx binaries left in deploy\tools\nginx (delete by hand if unwanted).'
}

# --------------------------------------------------------------------- status
function Invoke-Status {
    Write-Host '== scheduled tasks =='
    foreach ($t in $TaskNames) {
        $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        if ($null -eq $task) { Write-Host ('  ' + $t + ': MISSING'); continue }
        $i = Get-ScheduledTaskInfo -TaskName $t
        Write-Host ('  ' + $t + ': ' + $task.State + '  last run ' + $i.LastRunTime + '  last result 0x' + ('{0:X}' -f [int]$i.LastTaskResult))
    }
    Write-Host '== listeners (foreign owner = the zombie signature) =='
    foreach ($port in @(3000, 8080, 8081)) {
        $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        if (-not $conns.Count) { Write-Host ('  :' + $port + ' (none)'); continue }
        foreach ($c in $conns) {
            $procId = $c.OwningProcess
            $name = '?'
            try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
            Write-Host ('  :' + $port + ' PID ' + $procId + ' ' + $name + ' owned by ' + (Get-OwnerName $procId))
        }
    }
    Write-Host '== funnel =='
    if (Get-Command tailscale -ErrorAction SilentlyContinue) {
        cmd /c "tailscale funnel status 2>&1" | ForEach-Object { Write-Host ('  ' + $_) }
    } else { Write-Host '  tailscale CLI not found' }
    Write-Host '== last verify =='
    $vl = Join-Path $LogsDir 'verify.log'
    if (Test-Path $vl) { Get-Content $vl -Tail 3 | ForEach-Object { Write-Host ('  ' + $_) } }
    else { Write-Host '  (no verify.log yet)' }
    Write-Host '== last backup =='
    $lb = Join-Path $Root 'backend\.last-backup'
    if (Test-Path $lb) { Get-Content $lb -Tail 2 | ForEach-Object { Write-Host ('  ' + $_) } }
    else { Write-Host '  (no .last-backup yet)' }
}

# ------------------------------------------------------------------ dispatch
switch ($Verb) {
    'install'  { Invoke-Install }
    'remove'   { Invoke-Remove }
    'verify'   { exit (Invoke-Verify) }
    'watchdog' { Invoke-Watchdog }
    'firewall' { Invoke-Firewall }
    'status'   { Invoke-Status }
}
