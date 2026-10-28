require("./priority-smoke.cjs")(false).catch((e) => {
  console.error(e);
  process.exit(1);
});
