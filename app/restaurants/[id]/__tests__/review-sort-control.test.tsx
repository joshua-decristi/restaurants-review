import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fireEvent, render, screen } from "@testing-library/react";

import { writeReviewSortPreference } from "@/lib/browser-storage/client";

import { ReviewSortControl } from "../review-sort-control";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

const useRouterMock = jest.mocked(useRouter);
const usePathnameMock = jest.mocked(usePathname);
const useSearchParamsMock = jest.mocked(useSearchParams);

const PATHNAME = "/restaurants/42";

function reviewSortFromReplace(url: string): string | null {
  return new URL(url, "http://localhost").searchParams.get("reviewSort");
}

describe("ReviewSortControl", () => {
  const replace = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    useRouterMock.mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    usePathnameMock.mockReturnValue(PATHNAME);
  });

  it("keeps an explicit reviewSort query authoritative and does not restore storage", () => {
    localStorage.setItem("review-sort-preference", JSON.stringify({ reviewSort: "highest" }));
    useSearchParamsMock.mockReturnValue(new URLSearchParams("reviewSort=lowest") as unknown as ReturnType<typeof useSearchParams>);

    render(<ReviewSortControl reviewSort="lowest" />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Sort reviews")).toHaveValue("lowest");
  });

  it("restores a valid shared preference onto the current pathname when the query is empty", () => {
    writeReviewSortPreference({ reviewSort: "lowest" });
    useSearchParamsMock.mockReturnValue(new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>);

    render(<ReviewSortControl reviewSort="highest" />);

    expect(replace).toHaveBeenCalledTimes(1);
    const [url, options] = replace.mock.calls[0] as [string, { scroll: boolean }];
    expect(url.startsWith(PATHNAME)).toBe(true);
    expect(reviewSortFromReplace(url)).toBe("lowest");
    expect(options).toEqual({ scroll: false });
  });

  it("writes the preference and replaces the URL when a sort is selected", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("reviewSort=highest") as unknown as ReturnType<typeof useSearchParams>);

    render(<ReviewSortControl reviewSort="highest" />);

    fireEvent.change(screen.getByLabelText("Sort reviews"), { target: { value: "lowest" } });

    expect(JSON.parse(localStorage.getItem("review-sort-preference") ?? "null")).toEqual({
      reviewSort: "lowest",
    });
    expect(replace).toHaveBeenCalledTimes(1);
    const [url, options] = replace.mock.calls[0] as [string, { scroll: boolean }];
    expect(url.startsWith(PATHNAME)).toBe(true);
    expect(reviewSortFromReplace(url)).toBe("lowest");
    expect(options).toEqual({ scroll: false });
  });
});
