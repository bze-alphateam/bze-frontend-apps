import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useGuidedSteps } from "./use-guided-steps";

const KEYS = ["a", "b", "c"] as const;

// A tiny form: each key has a text answer; "bad" is an invalid answer.
function Harness({ initial = {} }: { initial?: Partial<Record<(typeof KEYS)[number], string>> }) {
    const [answers, setAnswers] = useState<Record<string, string>>({ a: "", b: "", c: "", ...initial });
    const [frozen, setFrozen] = useState(false);
    const valid = (v: string) => v !== "" && v !== "bad";
    const steps = useGuidedSteps(KEYS, { a: valid(answers.a), b: valid(answers.b), c: valid(answers.c) }, { frozen });

    return (
        <div>
            {KEYS.map(k => (
                <div key={k}>
                    <span data-testid={`state-${k}`}>{steps.state[k]}</span>
                    <button onClick={() => { setAnswers(s => ({ ...s, [k]: `${k}-answer` })); steps.close(); }}>answer {k}</button>
                    <button onClick={() => setAnswers(s => ({ ...s, [k]: "bad" }))}>break {k}</button>
                    <button onClick={() => steps.open(k)}>open {k}</button>
                    <button onClick={steps.step(k).onEdit}>edit {k}</button>
                    <span data-testid={`number-${k}`}>{steps.step(k).number}/{steps.step(k).total}</span>
                </div>
            ))}
            <span data-testid="direction">{steps.direction}</span>
            <button onClick={steps.back}>back</button>
            <button onClick={() => setFrozen(f => !f)}>toggle frozen</button>
        </div>
    );
}

const states = () => KEYS.map(k => screen.getByTestId(`state-${k}`).textContent);

describe("useGuidedSteps", () => {
    it("makes the first unanswered question active and the rest todo", async () => {
        render(<Harness />);
        expect(states()).toEqual(["active", "todo", "todo"]);

        await userEvent.click(screen.getByText("answer a"));
        expect(states()).toEqual(["done", "active", "todo"]);
    });

    it("starts past questions answered by preselects", () => {
        render(<Harness initial={{ a: "x", b: "y" }} />);
        expect(states()).toEqual(["done", "done", "active"]);
    });

    it("reopening a done question keeps the later answers, then moves to the next unanswered one", async () => {
        render(<Harness initial={{ a: "x", b: "y" }} />);
        await userEvent.click(screen.getByText("open a"));
        expect(states()).toEqual(["active", "done", "todo"]);

        await userEvent.click(screen.getByText("answer a"));
        expect(states()).toEqual(["done", "done", "active"]);
    });

    it("keeps the answers while frozen and follows them again once thawed", async () => {
        render(<Harness initial={{ a: "x", b: "y", c: "z" }} />);
        await userEvent.click(screen.getByText("toggle frozen"));
        await userEvent.click(screen.getByText("break b"));
        expect(states()).toEqual(["done", "done", "done"]);

        await userEvent.click(screen.getByText("toggle frozen"));
        expect(states()).toEqual(["done", "active", "done"]);
    });

    it("leaves no question active when all are answered", async () => {
        render(<Harness initial={{ a: "x", b: "y", c: "z" }} />);
        expect(states()).toEqual(["done", "done", "done"]);
    });

    it("turns a question whose answer became invalid active again", async () => {
        render(<Harness initial={{ a: "x", b: "y", c: "z" }} />);
        await userEvent.click(screen.getByText("break b"));
        expect(states()).toEqual(["done", "active", "done"]);
    });

    it("an earlier invalidated question wins over a later reopened one", async () => {
        render(<Harness initial={{ a: "x", b: "y", c: "z" }} />);
        await userEvent.click(screen.getByText("open c"));
        await userEvent.click(screen.getByText("break a"));
        expect(states()).toEqual(["active", "done", "done"]);
    });
});

describe("useGuidedSteps direction", () => {
    const direction = () => screen.getByTestId("direction").textContent;

    it("numbers each step out of the total", () => {
        render(<Harness />);
        expect(screen.getByTestId("number-b").textContent).toBe("2/3");
    });

    it("moves forward when a step is answered", async () => {
        render(<Harness />);
        expect(direction()).toBe("forward");
        await userEvent.click(screen.getByText("answer a"));
        expect(states()).toEqual(["done", "active", "todo"]);
        expect(direction()).toBe("forward");
    });

    it("moves back with Back, then forward again on Continue", async () => {
        render(<Harness initial={{ a: "x" }} />);
        await userEvent.click(screen.getByText("back"));
        expect(states()).toEqual(["active", "todo", "todo"]);
        expect(direction()).toBe("back");

        await userEvent.click(screen.getByText("answer a"));
        expect(states()).toEqual(["done", "active", "todo"]);
        expect(direction()).toBe("forward");
    });

    it("moves back when an earlier step is edited", async () => {
        render(<Harness initial={{ a: "x", b: "y" }} />);
        await userEvent.click(screen.getByText("edit a"));
        expect(states()).toEqual(["active", "done", "todo"]);
        expect(direction()).toBe("back");
    });

    it("Back on the first step does nothing", async () => {
        render(<Harness />);
        await userEvent.click(screen.getByText("back"));
        expect(states()).toEqual(["active", "todo", "todo"]);
        expect(direction()).toBe("forward");
    });
});
