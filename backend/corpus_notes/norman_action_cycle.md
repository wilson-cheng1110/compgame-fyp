# Norman's Action Cycle — COMP3423 reference notes (topic: norman)

## What it is
Don Norman's **Action Cycle** (from *The Design of Everyday Things*) is a model of how
a person carries out and evaluates any interaction with a system. It describes an
interaction as a loop of **seven stages of action**, running from the goal the person
holds in their head, out into action on the world, and back again as they read the
result. Because it is a cycle, one pass usually feeds the next: you evaluate the
outcome, and if the goal is not yet met you form a new plan and go round again. Norman's
action cycle is the standard HCI lens for asking *where*, precisely, an interaction
broke down.

## The seven stages of action
The seven stages split into two halves — an **execution side** (doing something to the
world) and an **evaluation side** (sensing and making sense of what the world did back).

Execution side (working out and carrying out *what to do*):
1. **Form the goal** — decide what you want to achieve (e.g. "get a paper copy of this report").
2. **Form the intention / Plan** — decide on a course of action that would reach the goal.
3. **Specify the action** — turn the plan into a specific action the system offers (choose "File → Print…").
4. **Execute / Perform the action** — actually carry it out (click Print, type, tap, speak).

Evaluation side (working out *whether it worked*):
5. **Perceive the state of the world** — observe the feedback the system gives (a tray icon flashes, a message appears).
6. **Interpret the perception** — make sense of what was perceived; does it mean what you expected?
7. **Evaluate the outcome** — compare the new state against the original goal, and decide whether you are done or must try again.

(The COMPGame teaching game labels these stages Form a Goal, Plan, Specify Action,
Perform Action, Perceive State, Interpret State, Evaluate Outcome — the same seven
stages. The stage *numbers* are just a presentation aid.)

## The two gulfs
Two gaps can open up between the user and the system, one on each side of the cycle.

- **Gulf of Execution** — the gap between the user's goals and intentions and the actions
  the system actually makes available. It is wide when the user knows what they want to do
  but cannot find or figure out how to do it: no visible control, no obvious gesture, an
  unclear label. Example: a user wants to rename a file but no menu, button or gesture
  anywhere offers "rename". The Gulf of Execution is bridged by making the possible actions
  easy to discover and match to intentions — through clear **affordances and signifiers**,
  sensible **mappings** between controls and effects, and helpful **constraints**.

- **Gulf of Evaluation** — the gap between the actual state the system is in and the user's
  ability to perceive and interpret that state. It is wide when the system does something
  but does not report it in a form the user can read: no feedback, ambiguous feedback, or
  feedback too brief to catch. Example: a microwave finishes, falls silent and leaves a
  blank display, so the user has to open the door just to check. The Gulf of Evaluation is
  bridged by giving **feedback** that is perceptible and interpretable — a visible, honest
  **system image** of what just happened and what state the system is now in.

Good design narrows both gulfs: it makes the right actions easy to find (execution) and
makes the results of those actions easy to perceive and understand (evaluation).

## Worked HCI examples
- **Printing (the classic walk-through):** Goal = a physical copy of a report. Plan = print
  it. Specify = choose "Print…". Execute = click Print. Perceive = a printer icon flashes in
  the tray for two seconds. Interpret = did that mean it queued, or that it failed? Evaluate =
  walk to the printer, find no paper, conclude the goal was **not** met — and restart the
  cycle (check the print queue, try again). The weak, two-second feedback is a **Gulf of
  Evaluation** problem.
- **Silent completion:** a file copies successfully but no confirmation ever appears — the
  user cannot tell it worked. Wide Gulf of Evaluation; fix with a completion message.
- **Hidden capability:** the export runs fine, but the button to start it is buried where the
  user never finds it. Wide Gulf of Execution; fix with a clearly labelled, visible control.
- **Interpretation failure:** a washing-machine app shows a spinning icon that never changes.
  The user can *perceive* it perfectly but cannot *interpret* what it means — the failure is
  in stage 6, on the evaluation side.

## Why it matters in HCI
The action cycle turns "the interface is confusing" into a precise diagnosis: is the
breakdown on the **execution side** (the user cannot work out how to act) or the
**evaluation side** (the user cannot work out what happened)? Naming the failing stage and
the gulf it sits in tells the designer exactly which repair to make — a clearer signifier and
mapping for an execution-side gap, or better feedback and a clearer system image for an
evaluation-side gap.
