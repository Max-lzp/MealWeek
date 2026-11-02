import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chineseNumber,
  estimateFoodText,
  rewriteFoodText,
} from "../src/lib/food-text";
test("中文/阿拉伯数量、克/公斤/个换算，只换算一次", () => {
  const r = estimateFoodText("米饭两百克，一个鸡蛋");
  assert.equal(r.complete, true);
  assert.equal(r.items[0].grams, 200);
  assert.equal(r.items[1].grams, 50);
  assert.equal(r.low, 230);
  assert.equal(r.high, 370);
  assert.equal(estimateFoodText("鸡胸肉0.1公斤").items[0].grams, 100);
  assert.equal(estimateFoodText("牛奶250毫升").items[0].grams, 250);
  assert.equal(estimateFoodText("香蕉半根").items[0].grams, 59);
});
test("未知食物、未知单位、不明确数量均不伪造总热量", () => {
  for (const description of [
    "米饭一碗",
    "火锅一份",
    "鸡蛋",
    "米饭0克",
    "米饭二百五克",
    "米饭100克鸡蛋1个",
  ]) {
    const r = estimateFoodText(description);
    assert.equal(r.complete, false, description);
    assert.equal(r.low, null);
    assert.equal(r.high, null);
  }
  const partial = estimateFoodText("米饭100克，披萨一份");
  assert.equal(partial.knownLow, 90);
  assert.equal(partial.low, null);
  assert.equal(partial.items.length, 2);
});
test("语音替换、追加和修改单项数量，不静默改错食物", () => {
  assert.equal(
    rewriteFoodText("米饭100克，鸡蛋1个", "把米饭改成200克", "replace").text,
    "米饭200克，鸡蛋1个",
  );
  assert.equal(
    rewriteFoodText("米饭100克", "鸡蛋一个", "append").text,
    "米饭100克，鸡蛋一个",
  );
  assert.equal(
    rewriteFoodText("米饭100克", "鸡胸肉150克", "replace").text,
    "鸡胸肉150克",
  );
  assert.ok(rewriteFoodText("鸡蛋1个", "把米饭改成200克", "replace").error);
  assert.ok(
    rewriteFoodText("米饭100克，米饭200克", "把米饭改成200克", "replace").error,
  );
});
test("数字不将含糊中文简称或无效值当作有效份量", () => {
  assert.equal(chineseNumber("两百二十"), 220);
  assert.equal(chineseNumber("一百零五"), 105);
  assert.equal(chineseNumber("二百五"), null);
  assert.equal(chineseNumber("一二三"), null);
  assert.equal(chineseNumber("-1"), null);
  assert.equal(chineseNumber("半"), 0.5);
});
