import { render, screen } from "@testing-library/react";
import Configure from "./Configure";

test("renders learn react link", () => {
  render(<Configure />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
