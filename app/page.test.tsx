import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("home page", () => {
  it("renders the boilerplate card with auth links", () => {
    render(<Home />);

    expect(screen.getByText("Boilerplate ready")).toBeInTheDocument();
    expect(screen.getByText("The application shell is running on shadcn/ui primitives.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Protected page" })).toBeInTheDocument();
  });
});
