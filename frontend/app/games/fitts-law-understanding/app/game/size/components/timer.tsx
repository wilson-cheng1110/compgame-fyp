interface TimerProps {
  time: number
}

export default function Timer({ time }: TimerProps) {
  const seconds = Math.floor(time / 10)
  const decimal = time % 10

  return (
    <div
      className="font-press-start"
      style={{
        position: "absolute",
        left: "1734px",
        top: "63px",
        color: "#009AB5",
        fontSize: "40px",
      }}
    >
      {`${seconds}.${decimal}`}
    </div>
  )
}
