import { Button, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ResponsiveDialog from "./ResponsiveDialog";

function mockViewport(mobile: boolean) {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: mobile && query.includes("max-width"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

describe("ResponsiveDialog", () => {
    it("uses a full-screen surface at the mobile breakpoint", () => {
        mockViewport(true);
        render(
            <ResponsiveDialog open>
                <DialogTitle>Mobile dialog</DialogTitle>
                <DialogContent>Content</DialogContent>
                <DialogActions><Button>Close</Button></DialogActions>
            </ResponsiveDialog>,
        );

        expect(screen.getByRole("dialog")).toHaveClass("MuiDialog-paperFullScreen");
        expect(screen.getByRole("button", {name: "Close"})).toBeInTheDocument();
    });

    it("keeps a centered paper on wider viewports", () => {
        mockViewport(false);
        render(
            <ResponsiveDialog open>
                <DialogTitle>Desktop dialog</DialogTitle>
                <DialogContent>Content</DialogContent>
            </ResponsiveDialog>,
        );

        expect(screen.getByRole("dialog")).not.toHaveClass("MuiDialog-paperFullScreen");
    });
});
