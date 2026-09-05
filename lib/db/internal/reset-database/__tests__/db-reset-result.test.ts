import { rowsFromExecute } from "../index";

describe("rowsFromExecute", () => {
  it("returns postgres.js-style row arrays as-is", () => {
    const rows = [{ table_name: "users" }, { table_name: "reviews" }];
    expect(rowsFromExecute(rows)).toEqual(rows);
  });

  it("unwraps Neon-style { rows } results", () => {
    const rows = [{ table_name: "users" }];
    expect(rowsFromExecute({ rows, command: "SELECT", rowCount: 1 })).toEqual(rows);
  });

  it("rejects unrecognized shapes instead of yielding zero rows", () => {
    expect(() => rowsFromExecute({ rowCount: 0 })).toThrow(/Unrecognized database execute result shape/);
    expect(() => rowsFromExecute(null)).toThrow(/Unrecognized database execute result shape/);
    expect(() => rowsFromExecute({ rows: "nope" })).toThrow(/Unrecognized database execute result shape/);
  });
});
