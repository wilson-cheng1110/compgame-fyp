// Shared quiz helpers.
//
// Why this exists: every MCQ in the app was authored with the correct option
// in a fixed position (most quizzes had the answer at index 0, a few at index 1).
// That lets a student score 100% by always clicking the first option, and it
// correlates "correct" with "longest text". shuffleQuestions() randomises the
// option order on each play-through and remaps the answer index so the correct
// answer lands in an unpredictable position.

export interface MCQuestion {
  q: string
  options: string[]
  answer: number
  explanation: string
}

// Fisher-Yates shuffle of option indices, returning a question with reordered
// options and the answer index updated to wherever the correct option moved.
function shuffleOne<T extends MCQuestion>(question: T): T {
  const order = question.options.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const options = order.map((i) => question.options[i])
  const answer = order.indexOf(question.answer)
  return { ...question, options, answer }
}

export function shuffleQuestions<T extends MCQuestion>(questions: T[]): T[] {
  return questions.map(shuffleOne)
}
