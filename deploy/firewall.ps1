#Requires -RunAsAdministrator
# deploy/firewall.ps1 - COMPGame rebuild firewall baseline.
# Architecture decision (Wilson, 2026-10-23): public student access stays on the
# Tailscale funnel (same as pre-incident) PLUS this firewall baseline. The funnel
# terminates TLS at the Tailscale edge and proxies to 127.0.0.1:3000, so no app
# ever needs a non-loopback listener.
#
# Idempotent. Preview with -WhatIf. Undo with -Revert.
# Run only on the rebuilt box, only after Tailscale is up, through the deploy gate.
#
# Deliberately NOT done here (and why):
#  - No per-app port block rules: profile default-deny inbound already covers
#    them, and loopback traffic bypasses Windows Firewall, so 127.0.0.1:3000/8080
#    and the funnel path keep working untouched.
#  - No RFC1918 block rule: default-deny inbound subsumes it; the only allows are
#    the Tailscale interface and Parsec.
#  - No outbound restriction: Ollama, updates and data pulls need egress.
#  - The funnel itself is not touched; see the deploy runbook for those steps.
#
# Already in the rebuild backlog (not this script): C4 Next.js pin bump.

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Revert
)

$ErrorActionPreference = 'Stop'
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

# --- Guard: never cut the branch we are sitting on ------------------------------
$ts = Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceDescription -like '*Tailscale*' -or $_.Name -like '*Tailscale*' } |
    Select-Object -First 1
if ($null -eq $ts) {
    throw 'No Tailscale adapter found. Bring Tailscale up first; aborting so default-deny cannot lock out remote administration.'
}

# --- Allow rules (created BEFORE default-deny) ----------------------------------
Remove-OurRule ($Prefix + 'Tailscale-Inbound')
if ($PSCmdlet.ShouldProcess($Prefix + 'Tailscale-Inbound', 'New-NetFirewallRule')) {
    New-NetFirewallRule -DisplayName ($Prefix + 'Tailscale-Inbound') `
        -Direction Inbound -Action Allow -InterfaceAlias $ts.Name `
        -Description 'Management plane: inbound from the tailnet only.' | Out-Null
}

# Parsec host needs inbound UDP for direct peer traffic. Kept explicit so the
# default-deny profile cannot silently sever remote administration.
$parsecSvc = Get-CimInstance Win32_Service -Filter "Name='parsecd'" -ErrorAction SilentlyContinue
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

# --- Disable third-party inbound allow rules (recorded for -Revert) --------------
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

# --- Default-deny LAST, and only if the Tailscale allow rule really exists -------
$guard = Get-NetFirewallRule -DisplayName ($Prefix + 'Tailscale-Inbound') -ErrorAction SilentlyContinue
if ($null -eq $guard -and -not $WhatIfPreference) {
    throw 'Tailscale allow rule missing after creation; refusing to enable default-deny (lockout guard).'
}
if ($PSCmdlet.ShouldProcess('Domain,Public,Private profiles', 'Inbound Block / outbound Allow')) {
    Set-NetFirewallProfile -Profile Domain, Public, Private -Enabled True `
        -DefaultInboundAction Block -DefaultOutboundAction Allow
}

Write-Output ('Done. COMPGame rules present: ' + @((Get-OurRules)).Count +
    '; third-party inbound allows disabled: ' + $disabled.Count)
