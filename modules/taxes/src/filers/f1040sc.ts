import { Events, ExpenseEvent, IncomeEvent, EventTypes } from "@finances/types";
import { ContextLogger, LevelLogger, math } from "@finances/utils";

import { env } from "../env";
import { Forms } from "../types";

const { add, gt, lt, mul, round, sub } = math;

export const f1040sc = (vmEvents: Events, oldForms: Forms): Forms => {
  const log = new ContextLogger("f1040sc", new LevelLogger(env.logLevel));
  const forms = JSON.parse(JSON.stringify(oldForms)) as Forms;
  const { f1040, f1040s1, f1040sc, f1040sse } = forms;

  f1040sc.FullName = `${f1040.FirstNameMI} ${f1040.LastName}`;
  f1040sc.SSN = f1040.SocialSecurityNumber;

  let totalIncome = "0";

  vmEvents.filter(l => l.type === EventTypes.Income).forEach((income: IncomeEvent): void => {
    let value = round(mul(income.quantity, income.assetPrice));
    if (income.taxTags.includes("ignore")) {
      log.info(`${income.date} Ignoring income: ${income.description} (worth ${value}) (total ${round(totalIncome)})`);
    } else if (income.taxTags.some(tag => tag.startsWith("multiply-"))) {
      const tag = income.taxTags.find(tag => tag.startsWith("multiply-"));
      const multiplier = tag.split("-")[1];
      value = mul(value, multiplier);
      totalIncome = add(totalIncome, value);
      log.info(`${income.date} Multiplying income by ${multiplier}: ${income.description} (worth ${value}) (total ${round(totalIncome)})`);
    } else {
      totalIncome = add(totalIncome, value);
      log.info(`${income.date} Adding income: ${income.description} (worth ${value}) (total ${round(totalIncome)})`);
    }
  });

  f1040sc.L1 = round(totalIncome);
  log.info(`Total income: ${f1040sc.L1}`);
  f1040sc.L3 = round(sub(f1040sc.L1, f1040sc.L2));

  // TODO: Part III

  f1040sc.L4 = f1040sc.L42;
  f1040sc.L5 = round(sub(f1040sc.L3, f1040sc.L4));
  f1040sc.L7 = round(add(f1040sc.L5, f1040sc.L6));

  let otherExpenseIndex = 1;
  for (const expense of vmEvents.filter(l => l.type === EventTypes.Expense) as ExpenseEvent[]) {
    const tags = expense.taxTags;
    if (!tags.some(tag => tag.startsWith("f1040sc")) || tags.includes("ignore")) {
      log.info(`${expense.date} Ignoring expense: ${expense.description}`);
    } else {
      let value = round(mul(expense.quantity, expense.assetPrice));

      if (expense.taxTags.some(tag => tag.startsWith("multiply-"))) {
        const tag = expense.taxTags.find(tag => tag.startsWith("multiply-"));
        const multiplier = tag.split("-")[1];
        value = mul(value, multiplier);
        log.info(`${expense.date} Multiplying expense by ${multiplier}: ${expense.description} (worth ${value})`);
      }

      const otherExpenseKey = "f1040sc-L48:";
      if (tags.some(tag => tag.startsWith(otherExpenseKey))) {
        const description = tags
          .find(tag => tag.startsWith(otherExpenseKey))
          .replace(otherExpenseKey, "");
        log.info(`${expense.date} Adding misc expense: ${expense.description}`);
        f1040sc[`L48R${otherExpenseIndex}_desc`] = description;
        f1040sc[`L48R${otherExpenseIndex}_amt`] = value;
        f1040sc.L48 = add(f1040sc.L48, value);
        otherExpenseIndex += 1;
      }
      for (const row of [
        "L8", "L9", "L10", "L11", "L12",
        "L13", "L14", "L15", "L16a", "L16b",
        "L17", "L18", "L19", "L20a", "L20b",
        "L21", "L22", "L23", "L24a", "L24b",
        "L25", "L26", "L27a", "L27b",
      ]) {
        if (tags.some(tag => tag.startsWith(`f1040sc-${row}`))) {
          log.info(`${expense.date} Adding ${row} expense: ${expense.description}`);
          f1040sc[row] = add(f1040sc[row], value);
        }
      }
    }
  }

  f1040sc.L28 = add(
    f1040sc.L8, f1040sc.L9, f1040sc.L10, f1040sc.L11, f1040sc.L12,
    f1040sc.L13, f1040sc.L14, f1040sc.L15, f1040sc.L16a, f1040sc.L16b,
    f1040sc.L17, f1040sc.L18, f1040sc.L19, f1040sc.L20a, f1040sc.L20b,
    f1040sc.L21, f1040sc.L22, f1040sc.L23, f1040sc.L24a, f1040sc.L24b,
    f1040sc.L25, f1040sc.L26, f1040sc.L27a, f1040sc.L27b, f1040sc.L48,
  );

  f1040sc.L29 = round(sub(f1040sc.L7, f1040sc.L28));
  f1040sc.L31 = round(sub(f1040sc.L29, f1040sc.L30));

  if (gt(f1040sc.L31, "0")) {
    f1040s1.L3 = f1040sc.L31;
    f1040sse.P1L2 = f1040sc.L31;
  } else if (lt(f1040sc.L31, "0")) {
    if (f1040sc.C32a) {
      f1040s1.L3 = f1040sc.L31;
      f1040sse.P1L2 = f1040sc.L31;
    }
  }

  return { ...forms, f1040s1, f1040sc, f1040sse };
};
