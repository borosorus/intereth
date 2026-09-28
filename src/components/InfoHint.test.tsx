import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import InfoHint from "./InfoHint";

describe("InfoHint", () => {
    it("exposes an accessible named button", () => {
        render(<InfoHint label="About things" content="Tooltip text" />);
        expect(screen.getByRole("button", {name: "About things"})).toBeInTheDocument();
    });

    it("reveals its content on keyboard focus", async () => {
        render(<InfoHint label="About things" content="Tooltip text" />);
        screen.getByRole("button", {name: "About things"}).focus();
        expect(await screen.findByText("Tooltip text")).toBeInTheDocument();
    });

    it("reveals its content on pointer hover", async () => {
        render(<InfoHint label="About things" content="Tooltip text" />);
        fireEvent.mouseEnter(screen.getByRole("button", {name: "About things"}));
        expect(await screen.findByText("Tooltip text")).toBeInTheDocument();
    });
});
