import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

/**
 * This Route Handler replaces the legacy PHP reporting scripts.
 * It receives lab results from the legacy HTML iframes and saves them
 * as .txt files in the public/legacy-labs/results folder.
 */
export async function POST(request: Request) {
  try {
    // 1. Parse the incoming JSON data from the legacy lab
    const body = await request.json()
    const { sid, labId, results } = body

    // 2. Validate that we have the necessary identifiers
    if (!sid || !labId) {
      return NextResponse.json(
        { success: false, error: "Missing Student ID (sid) or Lab ID" },
        { status: 400 },
      )
    }

    // 3. Define the storage directory
    // process.cwd() points to the root of your project
    const resultsDir = path.join(process.cwd(), "public", "legacy-labs", "results")

    // 4. Ensure the results directory exists, create it if it doesn't
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true })
    }

    // 5. Construct the filename (e.g., 22077541D_lab1.txt)
    const fileName = `${sid}_${labId}.txt`
    const filePath = path.join(resultsDir, fileName)

    // 6. Prepare the content to be saved
    // We wrap the raw results with a timestamp and the participant's ID
    const fileContent = JSON.stringify(
      {
        participantId: sid,
        labId: labId,
        timestamp: new Date().toLocaleString(),
        results: results,
      },
      null,
      2, // Formats the JSON for better readability in the .txt file
    )

    // 7. Write the file to the disk
    fs.writeFileSync(filePath, fileContent, "utf8")

    console.log(`[API] Successfully saved results for ${sid} at ${fileName}`)

    return NextResponse.json({
      success: true,
      message: "Lab results saved successfully",
      path: `/legacy-labs/results/${fileName}`,
    })
  } catch (error: any) {
    console.error("[API Error] Failed to save lab data:", error.message)
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    )
  }
}