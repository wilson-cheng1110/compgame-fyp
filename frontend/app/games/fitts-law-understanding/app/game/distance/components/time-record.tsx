interface TimeRecordProps {
  records: { [key: string]: number }
}

export default function TimeRecord({ records }: TimeRecordProps) {
  const formatTime = (time: number) => {
    const seconds = Math.floor(time / 10)
    const decimal = time % 10
    return `${seconds}.${decimal}`
  }

  return (
    <div>
      <div
        className="font-press-start"
        style={{
          position: "absolute",
          left: "1661px",
          top: "303px",
          fontSize: "40px",
          color: "#009AB5",
        }}
      >
        {records["A"] !== undefined ? formatTime(records["A"]) : ""}
      </div>
      <div
        className="font-press-start"
        style={{
          position: "absolute",
          left: "1661px",
          top: "390px",
          fontSize: "40px",
          color: "#009AB5",
        }}
      >
        {records["B"] !== undefined ? formatTime(records["B"]) : ""}
      </div>
    </div>
  )
}
