import React, { useMemo, useState } from "react";

const SUITS = { m: { label: "萬" }, p: { label: "筒" }, s: { label: "索" }, z: { label: "字" } };
const HONORS = ["東", "南", "西", "北", "白", "發", "中"];
const ALL_TILES_4P = [
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}m`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
  ...Array.from({ length: 7 }, (_, i) => `${i + 1}z`),
];
const ALL_TILES_3P = [
  "1m", "9m",
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
  ...Array.from({ length: 7 }, (_, i) => `${i + 1}z`),
];

function tileName(tile) {
  const n = Number(tile[0]);
  const suit = tile[1];
  if (suit === "z") return HONORS[n - 1];
  return `${n}${SUITS[suit].label}`;
}
function tileImageSrc(tile) { return `/tiles/${tile}.png`; }
function tileIndex(tile) {
  const n = Number(tile[0]) - 1;
  const suit = tile[1];
  if (suit === "m") return n;
  if (suit === "p") return 9 + n;
  if (suit === "s") return 18 + n;
  return 27 + n;
}
function tileCounts(tiles) {
  const counts = Array(34).fill(0);
  tiles.forEach((t) => { counts[tileIndex(t)] += 1; });
  return counts;
}
function isYaochuIndex(i) {
  if (i >= 27) return true;
  const n = (i % 9) + 1;
  return n === 1 || n === 9;
}
function meldTiles(meld) {
  if (meld.type === "pon") return [meld.tile, meld.tile, meld.tile];
  if (meld.type === "kan") return [meld.tile, meld.tile, meld.tile, meld.tile];
  if (meld.type === "kita") return ["4z"];
  return meld.tiles || [];
}
function allMeldTiles(melds) { return melds.flatMap(meldTiles); }
function openMeldCount(melds) { return melds.filter((m) => m.type !== "kita").length; }
function kitaCount(melds) { return melds.filter((m) => m.type === "kita").length; }

function normalShanten(counts, openCount = 0) {
  let best = 8;
  function dfs(c, idx, melds, taatsu, pair) {
    while (idx < 34 && c[idx] === 0) idx++;
    if (idx >= 34) {
      const totalMelds = melds + openCount;
      const usefulTaatsu = Math.min(taatsu, Math.max(0, 4 - totalMelds));
      const shanten = 8 - totalMelds * 2 - usefulTaatsu - pair;
      best = Math.min(best, shanten);
      return;
    }
    if (c[idx] >= 3) { c[idx] -= 3; dfs(c, idx, melds + 1, taatsu, pair); c[idx] += 3; }
    const pos = idx % 9;
    if (idx < 27 && pos <= 6 && c[idx + 1] > 0 && c[idx + 2] > 0) {
      c[idx]--; c[idx + 1]--; c[idx + 2]--;
      dfs(c, idx, melds + 1, taatsu, pair);
      c[idx]++; c[idx + 1]++; c[idx + 2]++;
    }
    if (pair === 0 && c[idx] >= 2) { c[idx] -= 2; dfs(c, idx, melds, taatsu, 1); c[idx] += 2; }
    if (c[idx] >= 2) { c[idx] -= 2; dfs(c, idx, melds, taatsu + 1, pair); c[idx] += 2; }
    if (idx < 27) {
      if (pos <= 7 && c[idx + 1] > 0) { c[idx]--; c[idx + 1]--; dfs(c, idx, melds, taatsu + 1, pair); c[idx]++; c[idx + 1]++; }
      if (pos <= 6 && c[idx + 2] > 0) { c[idx]--; c[idx + 2]--; dfs(c, idx, melds, taatsu + 1, pair); c[idx]++; c[idx + 2]++; }
    }
    c[idx]--; dfs(c, idx, melds, taatsu, pair); c[idx]++;
  }
  dfs([...counts], 0, 0, 0, 0);
  return best;
}
function chiitoiShanten(counts) {
  const pairs = counts.filter((x) => x >= 2).length;
  const unique = counts.filter((x) => x > 0).length;
  return 6 - pairs + Math.max(0, 7 - unique);
}
function kokushiShanten(counts) {
  let kinds = 0, pair = 0;
  for (let i = 0; i < 34; i++) {
    if (isYaochuIndex(i) && counts[i] > 0) kinds++;
    if (isYaochuIndex(i) && counts[i] >= 2) pair = 1;
  }
  return 13 - kinds - pair;
}
function calcShanten(tiles, melds = []) {
  if (!tiles.length && melds.length === 0) return null;
  const counts = tileCounts(tiles);
  const openCount = openMeldCount(melds);
  const normal = normalShanten(counts, openCount);
  const sevenPairs = openCount === 0 ? chiitoiShanten(counts) : 99;
  const kokushi = openCount === 0 ? kokushiShanten(counts) : 99;
  const min = Math.min(normal, sevenPairs, kokushi);
  return { normal, sevenPairs, kokushi, min };
}
function countSequenceHints(counts) {
  let hints = 0;
  for (const start of [0, 9, 18]) {
    for (let i = start; i < start + 7; i++) {
      if (counts[i] && counts[i + 1] && counts[i + 2]) hints += 1.2;
      else if (counts[i] && counts[i + 1]) hints += 0.65;
      else if (counts[i] && counts[i + 2]) hints += 0.45;
    }
  }
  return hints;
}

function analyzeYaku(tiles, mode, seatWind, roundWind, melds = []) {
  if (!tiles.length && melds.length === 0) return [];
  const allTiles = [...tiles, ...allMeldTiles(melds)];
  const counts = tileCounts(allTiles);
  const handCounts = tileCounts(tiles);
  const total = Math.max(1, allTiles.length);
  const openCount = openMeldCount(melds);
  const isMenzen = openCount === 0;
  const ponCount = melds.filter((m) => m.type === "pon").length;
  const chiCount = melds.filter((m) => m.type === "chi").length;
  const kanCount = melds.filter((m) => m.type === "kan").length;
  const nukiKitaCount = kitaCount(melds);

  const terminalsHonors = counts.reduce((acc, n, i) => acc + (isYaochuIndex(i) ? n : 0), 0);
  const simpleTiles = total - terminalsHonors;
  const pairs = counts.filter((x) => x >= 2).length;
  const triplets = counts.filter((x) => x >= 3).length;
  const quads = counts.filter((x) => x >= 4).length + kanCount;
  const yaochuKinds = counts.filter((x, i) => x > 0 && isYaochuIndex(i)).length;
  const dragonTriplets = ["5z", "6z", "7z"].filter((t) => counts[tileIndex(t)] >= 3).length;
  const dragonPairs = ["5z", "6z", "7z"].filter((t) => counts[tileIndex(t)] >= 2).length;
  const windTriplets = ["1z", "2z", "3z", "4z"].filter((t) => counts[tileIndex(t)] >= 3).length;
  const windPairs = ["1z", "2z", "3z", "4z"].filter((t) => counts[tileIndex(t)] >= 2).length;
  const suitCounts = {
    m: counts.slice(0, 9).reduce((a, b) => a + b, 0),
    p: counts.slice(9, 18).reduce((a, b) => a + b, 0),
    s: counts.slice(18, 27).reduce((a, b) => a + b, 0),
    z: counts.slice(27, 34).reduce((a, b) => a + b, 0),
  };
  const maxSuit = Math.max(suitCounts.m, suitCounts.p, suitCounts.s);
  const sequences = countSequenceHints(counts) + chiCount * 1.2;
  const yaku = [];
  const add = (name, score, reason, condition = "", options = {}) => {
    if (options.menzenOnly && !isMenzen) return;
    if (options.noChi && chiCount > 0) score *= 0.25;
    const openNote = options.menzenOnly ? "門前限定" : options.openDown ? "鳴くと1翻下がる" : "";
    const finalCondition = [condition, openNote].filter(Boolean).join("。 ");
    yaku.push({ name, score: Math.max(0.01, Math.min(1, score)), reason: finalCondition ? `${reason}｜条件：${finalCondition}` : reason });
  };
  function hasSeq(suit, start) {
    const base = suit === "m" ? 0 : suit === "p" ? 9 : 18;
    return counts[base + start - 1] > 0 && counts[base + start] > 0 && counts[base + start + 1] > 0;
  }
  function seqScore(patterns) {
    let hit = 0; patterns.forEach(([s, st]) => { if (hasSeq(s, st)) hit++; }); return hit / patterns.length;
  }

  add("リーチ", sequences / 5, "門前でテンパイを目指す役", "テンパイしてリーチ宣言する", { menzenOnly: true });
  add("一発", 0.2, "リーチ後のボーナス役", "リーチ後1巡以内に鳴きが入らずアガる", { menzenOnly: true });
  add("門前清自摸和（ツモ）", sequences / 5, "門前でツモればつく役", "門前のままツモアガリする", { menzenOnly: true });
  add("タンヤオ", simpleTiles / total, "2〜8の数牌が多いほど近い");
  add("平和", Math.min(1, sequences / 5) * (pairs <= 2 ? 1 : 0.75) * (terminalsHonors <= 4 ? 1 : 0.8), "順子候補が多いほど近い", "4つの順子＋役牌でない雀頭＋両面待ち", { menzenOnly: true });

  const honorPairNames = [];
  [seatWind, roundWind, "5z", "6z", "7z"].forEach((t) => {
    if (t && counts[tileIndex(t)] >= 2 && !honorPairNames.includes(tileName(t))) honorPairNames.push(tileName(t));
  });
  add(honorPairNames.length ? `役牌（${honorPairNames.join("・")}）` : "役牌", honorPairNames.length ? 0.98 : 0.25, honorPairNames.length ? "役牌が対子以上ある" : "白發中・自風・場風の対子があると近い", "三元牌・場風・自風のどれかを刻子にする");

  let iipeikoScore = 0;
  for (const suit of ["m", "p", "s"]) {
    const base = suit === "m" ? 0 : suit === "p" ? 9 : 18;
    for (let st = 0; st <= 6; st++) {
      if (handCounts[base + st] >= 2 && handCounts[base + st + 1] >= 2 && handCounts[base + st + 2] >= 2) iipeikoScore = Math.max(iipeikoScore, 1);
      else if (handCounts[base + st] && handCounts[base + st + 1] && handCounts[base + st + 2]) iipeikoScore = Math.max(iipeikoScore, 0.45);
    }
  }
  add("一盃口", iipeikoScore, "同じ順子を2組作れそうなら近い", "同じ順子を2組作る", { menzenOnly: true });
  add("七対子", Math.min(1, pairs / 5.5), `${pairs}対子ある`, "対子を7組作る", { menzenOnly: true });
  add("対々和", Math.min(1, (pairs + triplets * 1.5 + ponCount * 1.8 + kanCount * 2.0) / 6), "対子・刻子・ポン・カンが多いほど近い", "4つの刻子/槓子＋雀頭で作る", { noChi: true });
  add("三暗刻", Math.min(1, (triplets - ponCount - kanCount) / 2.5), "手の中の暗刻候補が多いほど近い", "暗刻を3つ作る。ポンした刻子は暗刻にならない");
  add("三槓子", Math.min(1, quads / 2.5), "カンが多いほど近い", "槓子を3つ作る");
  add("混老頭", Math.min(1, terminalsHonors / total) * Math.min(1, pairs / 4), "么九牌だけに寄るほど近い", "1・9・字牌だけで作る");
  add("小三元", Math.min(1, (dragonTriplets * 2 + dragonPairs) / 5), "三元牌が多いほど近い", "白發中のうち2つを刻子、残り1つを雀頭にする");
  const sanshokuScores = [];
  for (let st = 1; st <= 7; st++) sanshokuScores.push(seqScore([["m", st], ["p", st], ["s", st]]));
  add("三色同順", Math.max(...sanshokuScores) + chiCount * 0.08, "同じ数字の順子が3色で見えるほど近い", "鳴いても可能", { openDown: true });
  const ittsuScore = Math.max(seqScore([["m", 1], ["m", 4], ["m", 7]]), seqScore([["p", 1], ["p", 4], ["p", 7]]), seqScore([["s", 1], ["s", 4], ["s", 7]]));
  add("一気通貫", ittsuScore + chiCount * 0.08, "同じ色で123・456・789が見えるほど近い", "鳴いても可能", { openDown: true });
  add("チャンタ", Math.min(1, terminalsHonors / total) * Math.min(1, sequences / 3.5), "端牌・字牌を使った順子が多いほど近い", "すべての面子と雀頭に么九牌を含める", { openDown: true });
  add("ダブル立直", 0.05, "開始直後のリーチ役", "鳴きのない1巡目にテンパイしてリーチする", { menzenOnly: true });
  add("混一色", Math.min(1, (maxSuit + suitCounts.z * 0.9) / total), "1色＋字牌に寄るほど近い", "鳴いても可能", { openDown: true });
  add("純チャン", Math.min(1, (counts[0]+counts[8]+counts[9]+counts[17]+counts[18]+counts[26]) / total) * Math.min(1, sequences / 3.5), "1・9牌を使った順子が多いほど近い", "すべての面子と雀頭に1・9牌を含める。字牌は使わない", { openDown: true });
  add("二盃口", iipeikoScore * Math.min(1, pairs / 2.5), "一盃口が2つ見えると候補", "同じ順子2組×2で作る", { menzenOnly: true });
  add("清一色", Math.min(1, maxSuit / total), "1色に寄るほど近い", "字牌なしで1種類の数牌だけにする", { openDown: true });
  add("ドラ", 0.15, "ドラは役ではなく打点アップ要素", "ドラ表示牌が必要。ドラだけではアガれない");
  add("赤ドラ", 0.15, "赤5があれば打点アップ", "赤5採用ルールで赤5を持っている必要がある");
  add("抜きドラ（北）", mode === "3p" && (counts[tileIndex("4z")] > 0 || nukiKitaCount > 0) ? 0.65 + Math.min(0.25, nukiKitaCount * 0.08) : 0.15, nukiKitaCount > 0 ? `北抜き${nukiKitaCount}枚登録済み` : "3人麻雀で北を抜くと打点アップしやすい", "北抜きありルール限定。抜きドラだけではアガれない");
  add("国士無双", Math.min(1, yaochuKinds / 10.5) * (mode === "3p" ? 1.08 : 0.92), `么九牌が${yaochuKinds}種類ある`, "1・9・字牌13種類＋どれか1つを対子にする", { menzenOnly: true });
  add("四暗刻", Math.min(1, (triplets - ponCount - kanCount) / 3.3), "暗刻候補が多いほど近い", "暗刻を4つ作る。ポンした刻子は暗刻にならない", { menzenOnly: true });
  add("大三元", Math.min(1, dragonTriplets / 2.5), "白發中の刻子が多いほど近い", "白・發・中をすべて刻子にする");
  add("小四喜", Math.min(1, (windTriplets * 2 + windPairs) / 7), "風牌が多いほど近い", "東南西北のうち3つを刻子、残り1つを雀頭にする");
  add("大四喜", Math.min(1, windTriplets / 3.3), "風牌の刻子が多いほど近い", "東南西北をすべて刻子にする");
  add("字一色", suitCounts.z / total, "字牌だけに寄るほど近い", "字牌だけで手を作る");
  add("清老頭", Math.min(1, (counts[0]+counts[8]+counts[9]+counts[17]+counts[18]+counts[26]) / total), "1・9牌だけに寄るほど近い", "数牌の1・9だけで手を作る。字牌は使わない");
  const greenTiles = ["2s", "3s", "4s", "6s", "8s", "6z"];
  const greenCount = greenTiles.reduce((sum, t) => sum + counts[tileIndex(t)], 0);
  add("緑一色", greenCount / total, "緑牌だけに寄るほど近い", "2索・3索・4索・6索・8索・發だけで手を作る");

  const nineGatesScore = Math.max(...["m", "p", "s"].map((suit) => {
    const base = suit === "m" ? 0 : suit === "p" ? 9 : 18;
    const suitTotal = counts.slice(base, base + 9).reduce((a, b) => a + b, 0);
    const otherTotal = total - suitTotal;
    const need = [3,1,1,1,1,1,1,1,3];
    let match = 0;
    for (let i = 0; i < 9; i++) match += Math.min(counts[base + i], need[i]);
    const shapeScore = match / 13;
    const oneSuitScore = suitTotal / total;
    const penalty = otherTotal > 0 ? Math.max(0.45, 1 - otherTotal * 0.12) : 1;
    return shapeScore * 0.75 + oneSuitScore * 0.25 * penalty;
  }));
  add("九蓮宝燈", nineGatesScore, "1色で1112345678999に近いほど候補", "門前限定。1色で1112345678999＋同色牌1枚", { menzenOnly: true });

  add("四槓子", Math.min(1, quads / 3.3), "槓子が多いほど近い", "槓子を4つ作る");
  add("天和", 0.03, "親の配牌時点の役満", "親が配牌14枚でそのままアガっている", { menzenOnly: true });
  add("地和", 0.03, "子の第1ツモの役満", "子が鳴きのない第1ツモでアガる", { menzenOnly: true });

  return yaku.map((y) => ({ ...y, score: Math.max(0, Math.min(1, y.score)) })).filter((y) => y.score >= 0.5).sort((a, b) => b.score - a.score);
}

function targetYakuAdjustment(tile, hand, targetYaku, seatWind, roundWind) {
  if (!targetYaku || targetYaku === "最速テンパイ") return { adjust: 0, reason: "" };
  const counts = tileCounts(hand);
  const idx = tileIndex(tile), n = Number(tile[0]), suit = tile[1], name = targetYaku;
  let adjust = 0; const reasons = [];
  const isSimple = suit !== "z" && n >= 2 && n <= 8;
  const isTerminal = suit !== "z" && (n === 1 || n === 9);
  const isHonor = suit === "z";
  const isValueHonor = tile === seatWind || tile === roundWind || ["5z", "6z", "7z"].includes(tile);
  const suitCounts = { m: counts.slice(0, 9).reduce((a, b) => a + b, 0), p: counts.slice(9, 18).reduce((a, b) => a + b, 0), s: counts.slice(18, 27).reduce((a, b) => a + b, 0) };
  const mainSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const hasNeighbor = (d) => suit !== "z" && n + d >= 1 && n + d <= 9 && counts[tileIndex(`${n + d}${suit}`)] > 0;
  if (name.includes("タンヤオ")) { if (isHonor || isTerminal) { adjust += 45; reasons.push("タンヤオでは不要になりやすい"); } if (isSimple) adjust -= 18; }
  if (name.includes("平和") || name.includes("リーチ") || name.includes("ツモ")) { if (isHonor && counts[idx] === 1) { adjust += 65; reasons.push("1枚字牌は順子手でかなり使いにくい"); } if (isTerminal && !hasNeighbor(1) && !hasNeighbor(2) && !hasNeighbor(-1) && !hasNeighbor(-2)) { adjust += 18; reasons.push("孤立端牌は順子手で弱い"); } if (suit !== "z" && (hasNeighbor(1) || hasNeighbor(-1) || hasNeighbor(2) || hasNeighbor(-2))) adjust -= 12; }
  if (name.includes("役牌")) { if (isValueHonor) adjust -= 35; if (isHonor && !isValueHonor && counts[idx] === 1) { adjust += 55; reasons.push("役牌以外の1枚字牌は整理優先"); } }
  if (name.includes("七対子")) { if (counts[idx] >= 2) adjust -= 35; if (counts[idx] === 1) { adjust += 12; reasons.push("七対子では孤立牌を整理"); } }
  if (name.includes("対々和") || name.includes("三暗刻") || name.includes("四暗刻")) { if (counts[idx] >= 2) adjust -= 35; if (counts[idx] === 1 && suit !== "z") { adjust += 12; reasons.push("刻子手では孤立数牌を整理"); } }
  if (name.includes("混一色") || name.includes("清一色") || name.includes("一気通貫") || name.includes("九蓮宝燈")) { if (suit !== "z" && suit !== mainSuit) { adjust += 38; reasons.push(`${SUITS[mainSuit]?.label || "多い色"}以外を整理`); } if (name.includes("清一色") && isHonor) { adjust += 35; reasons.push("清一色では字牌を使わない"); } if (name.includes("混一色") && (suit === mainSuit || isHonor)) adjust -= 18; if (name.includes("清一色") && suit === mainSuit) adjust -= 24; }
  if (name.includes("チャンタ") || name.includes("純チャン") || name.includes("混老頭") || name.includes("国士") || name.includes("清老頭")) { if (isSimple) { adjust += 32; reasons.push("么九牌系では中張牌を整理"); } if (isTerminal || isHonor) adjust -= 20; if ((name.includes("純チャン") || name.includes("清老頭")) && isHonor) { adjust += 28; reasons.push("この役では字牌を使わない"); } }
  if (name.includes("三色同順")) { if (suit === "z") { adjust += 20; reasons.push("三色同順では字牌を使わない"); } if (suit !== "z" && (hasNeighbor(1) || hasNeighbor(-1))) adjust -= 10; }
  if (name.includes("小三元") || name.includes("大三元")) { if (["5z", "6z", "7z"].includes(tile)) adjust -= 40; else if (isHonor && counts[idx] === 1) { adjust += 10; reasons.push("三元牌以外の字牌は優先度低め"); } else if (suit !== "z") adjust += 8; }
  if (name.includes("小四喜") || name.includes("大四喜")) { if (["1z", "2z", "3z", "4z"].includes(tile)) adjust -= 40; else if (["5z", "6z", "7z"].includes(tile)) { adjust += 18; reasons.push("風牌以外の字牌"); } else if (suit !== "z") adjust += 10; }
  if (name.includes("字一色")) { if (suit !== "z") { adjust += 45; reasons.push("字一色では数牌を使わない"); } else adjust -= 30; }
  if (name.includes("緑一色")) { const green = ["2s", "3s", "4s", "6s", "8s", "6z"].includes(tile); if (!green) { adjust += 45; reasons.push("緑一色で使えない牌"); } else adjust -= 30; }
  if (name.includes("一盃口") || name.includes("二盃口")) { if (suit === "z") { adjust += 20; reasons.push("一盃口系では字牌を使わない"); } if (counts[idx] >= 2) adjust -= 18; }
  return { adjust, reason: reasons[0] || "" };
}

function tileUsefulness(tile, counts, seatWind, roundWind) {
  const idx = tileIndex(tile), n = Number(tile[0]), suit = tile[1];
  let useful = 0; const reasons = [];
  if (counts[idx] >= 3) { useful += 45; reasons.push("刻子なので残したい"); }
  else if (counts[idx] >= 2) { useful += 28; reasons.push("対子なので残したい"); }
  if (suit === "z") {
    const isValue = tile === seatWind || tile === roundWind || ["5z", "6z", "7z"].includes(tile);
    if (isValue) { useful += 25; reasons.push("役牌候補"); }
    else if (counts[idx] === 1) { useful -= 75; reasons.push("1枚だけの字牌なので優先して整理"); }
    return { useful, reasons };
  }
  const neighbors = [];
  for (const d of [-2, -1, 1, 2]) { const nn = n + d; if (nn >= 1 && nn <= 9) neighbors.push(`${nn}${suit}`); }
  const connected = neighbors.filter((t) => counts[tileIndex(t)] > 0).length;
  if (connected >= 2) { useful += 22; reasons.push("周りの牌とつながりがある"); }
  else if (connected === 1) { useful += 10; reasons.push("少しつながりがある"); }
  else { useful -= [1, 9].includes(n) ? 18 : 10; reasons.push([1, 9].includes(n) ? "孤立した端牌" : "孤立牌"); }
  if ([3, 4, 5, 6, 7].includes(n)) useful += 8;
  if ([1, 9].includes(n)) useful -= 8;
  return { useful, reasons };
}
function discardPriorities(hand, mode, seatWind, roundWind, targetYaku = "最速テンパイ", melds = []) {
  if (!hand.length) return [];
  const base = calcShanten(hand, melds);
  const baseMin = base?.min ?? 8;
  const counts = tileCounts(hand);
  const uniqueTiles = [...new Set(hand)];
  return uniqueTiles.map((tile) => {
    const idxToRemove = hand.indexOf(tile);
    const nextHand = hand.filter((_, i) => i !== idxToRemove);
    const next = calcShanten(nextHand, melds);
    const nextMin = next?.min ?? 8;
    const delta = nextMin - baseMin;
    const { useful, reasons } = tileUsefulness(tile, counts, seatWind, roundWind);
    const target = targetYakuAdjustment(tile, hand, targetYaku, seatWind, roundWind);
    let score = 100 - nextMin * 26 - useful + target.adjust;
    if (tile[1] === "z" && counts[tileIndex(tile)] === 1 && !targetYaku.includes("国士") && !targetYaku.includes("字一色") && !targetYaku.includes("小四喜") && !targetYaku.includes("大四喜") && !targetYaku.includes("小三元") && !targetYaku.includes("大三元")) {
      score += 45;
    }
    if (delta > 0) score -= targetYaku === "最速テンパイ" ? 38 : 18;
    if (delta < 0) score += 25;
    const explain = [];
    if (targetYaku !== "最速テンパイ") explain.push(`${targetYaku}狙い`);
    if (delta > 0) explain.push("捨てるとシャンテン悪化");
    else if (delta < 0) explain.push("捨てると形が進む可能性");
    else explain.push("シャンテン維持");
    if (target.reason) explain.push(target.reason);
    explain.push(...reasons.slice(0, 2));
    return { tile, score, shantenAfter: nextMin, delta, reason: explain.join(" / ") };
  }).sort((a, b) => b.score - a.score);
}
function grade(score) { if (score >= 0.78) return "◎"; if (score >= 0.55) return "○"; if (score >= 0.35) return "△"; return "×"; }

function Tile({ tile, onClick, disabled = false, small = false, selected = false }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={tileName(tile)} className={`tile-btn ${small ? "tile-small" : "tile-normal"} ${selected ? "tile-selected" : ""}`}>
      {!imgError ? <img src={tileImageSrc(tile)} alt={tileName(tile)} className="tile-img" onError={() => setImgError(true)} /> : <div className="tile-fallback"><div className="tile-fallback-main">{tileName(tile)}</div></div>}
    </button>
  );
}
function TileRow({ tiles, onTileClick, selectedIndex }) {
  return (
    <div className="tile-row">
      {tiles.length === 0 ? <div className="empty-text">牌をクリックして追加</div> : tiles.map((t, i) => (
        <div key={`${t}-${i}`} className={tiles.length === 14 && i === 13 ? "tsumo-tile-wrap" : ""}>
          <Tile tile={t} small selected={selectedIndex === i} onClick={() => onTileClick && onTileClick(i)} />
          {tiles.length === 14 && i === 13 && <div className="tsumo-label">ツモ</div>}
        </div>
      ))}
    </div>
  );
}
function MeldView({ meld, onRemove, onUpgradeKan, canUpgradeKan }) {
  const label = meld.type === "pon" ? "ポン" : meld.type === "chi" ? "チー" : meld.type === "kan" ? "カン" : "北抜き";
  return (
    <div className="meld-view">
      <b>{label}</b>
      <div className="meld-tiles">{meldTiles(meld).map((t, i) => <Tile key={`${t}-${i}`} tile={t} small />)}</div>
      {meld.type === "pon" && (
        <button className="small-btn" disabled={!canUpgradeKan} onClick={onUpgradeKan}>
          加カン
        </button>
      )}
      <button className="small-btn danger" onClick={onRemove}>削除</button>
    </div>
  );
}
function TilePalette({ mode, onPick, countsLimit }) {
  const tiles = mode === "3p" ? ALL_TILES_3P : ALL_TILES_4P;
  return <div className="palette-wrap">{["m", "p", "s", "z"].map((suit) => <div className="palette-group" key={suit}><div className="palette-label">{SUITS[suit].label}</div><div className="palette-tiles">{tiles.filter((t) => t[1] === suit).map((t) => <Tile key={t} tile={t} onClick={() => onPick(t)} disabled={(countsLimit?.[tileIndex(t)] || 0) >= 4} />)}</div></div>)}</div>;
}

function App() {
  const [mode, setMode] = useState("4p");
  const [hand, setHand] = useState([]);
  const [seatWind, setSeatWind] = useState("1z");
  const [roundWind, setRoundWind] = useState("1z");
  const [selectedYaku, setSelectedYaku] = useState("最速テンパイ");
  const [selectedHandIndex, setSelectedHandIndex] = useState(null);
  const [meldMode, setMeldMode] = useState(null);
  const [melds, setMelds] = useState([]);
  const meldTileArray = useMemo(() => allMeldTiles(melds), [melds]);
  const visibleCounts = useMemo(() => tileCounts([...hand, ...meldTileArray]), [hand, meldTileArray]);
  const shanten = useMemo(() => calcShanten(hand, melds), [hand, melds]);
  const yakus = useMemo(() => analyzeYaku(hand, mode, seatWind, roundWind, melds), [hand, mode, seatWind, roundWind, melds]);
  const discardRanks = useMemo(() => discardPriorities(hand, mode, seatWind, roundWind, selectedYaku, melds), [hand, mode, seatWind, roundWind, selectedYaku, melds]);
  const selectedTile = selectedHandIndex != null ? hand[selectedHandIndex] : null;

  function canAdd(tile) { return (visibleCounts[tileIndex(tile)] || 0) < 4; }
  function addHand(tile) {
    if (hand.length >= 14 || !canAdd(tile)) return;
    if (hand.length >= 13) {
      // 14枚目はツモ牌として右端に固定する
      setHand([...hand, tile]);
    } else {
      // 13枚目までは見やすいように自動ソート
      setHand([...hand, tile].sort((a, b) => tileIndex(a) - tileIndex(b)));
    }
    setSelectedHandIndex(null);
  }
  function changeMode(nextMode) {
    setMode(nextMode);
    if (nextMode === "3p") {
      setMelds((prev) => prev.filter((m) => m.type !== "chi"));
      if (meldMode && meldMode.startsWith("chi")) setMeldMode(null);
    }
  }
  function removeTileAt(index) {
    const next = hand.filter((_, i) => i !== index);
    // ツモ牌を消した場合はそのまま。13枚以下になったら自動ソートに戻す。
    setHand(next.length <= 13 ? next.sort((a, b) => tileIndex(a) - tileIndex(b)) : next);
    setSelectedHandIndex(null);
  }
  function removeSelected() { if (selectedHandIndex == null) return; removeTileAt(selectedHandIndex); }
  function removeLast() {
    const next = hand.slice(0, -1);
    setHand(next.length <= 13 ? next.sort((a, b) => tileIndex(a) - tileIndex(b)) : next);
    setSelectedHandIndex(null);
  }
  function clearAll() { setHand([]); setMelds([]); setSelectedHandIndex(null); setSelectedYaku("最速テンパイ"); setMeldMode(null); }
  function removeTilesFromHand(tileList) {
    const next = [...hand];
    for (const t of tileList) {
      const idx = next.indexOf(t);
      if (idx === -1) return null;
      next.splice(idx, 1);
    }
    return next;
  }
  function makePonFromTile(tile) {
    if (!tile) return;
    const next = removeTilesFromHand([tile, tile]);
    if (!next) return alert("ポンには同じ牌が手牌に2枚必要です");
    setHand(next); setMelds([...melds, { type: "pon", tile }]); setSelectedHandIndex(null); setMeldMode(null);
  }
  function makePon() { makePonFromTile(selectedTile); }
  function makeKanFromTile(tile) {
    if (!tile) return;
    const next = removeTilesFromHand([tile, tile, tile, tile]);
    if (!next) return alert("暗カン登録には同じ牌が手牌に4枚必要です。ポン済みの牌をカンする場合は、鳴き欄の『加カン』を押してください。");
    setHand(next); setMelds([...melds, { type: "kan", tile, kanKind: "ankan" }]); setSelectedHandIndex(null); setMeldMode(null);
  }
  function makeKan() { makeKanFromTile(selectedTile); }
  function makeKitaFromTile(tile) {
    if (mode !== "3p") return;
    if (tile !== "4z") return alert("北抜きは北を選んでください");
    const next = removeTilesFromHand(["4z"]);
    if (!next) return alert("手牌に北が必要です");
    setHand(next);
    setMelds([...melds, { type: "kita", tile: "4z" }]);
    setSelectedHandIndex(null);
    setMeldMode(null);
  }
  function upgradePonToKan(meldIndex) {
    const meld = melds[meldIndex];
    if (!meld || meld.type !== "pon") return;
    const extraIndex = hand.indexOf(meld.tile);
    if (extraIndex === -1) return alert(`${tileName(meld.tile)}の4枚目が手牌に必要です`);
    const nextHand = hand.filter((_, i) => i !== extraIndex);
    const nextMelds = melds.map((m, i) => i === meldIndex ? { type: "kan", tile: m.tile, kanKind: "kakan" } : m);
    setHand(nextHand);
    setMelds(nextMelds);
    setSelectedHandIndex(null);
  }
  function makeChiFromTile(tile, offset) {
    if (!tile || tile[1] === "z") return;
    const n = Number(tile[0]);
    const suit = tile[1];
    const nums = [n + offset, n + offset + 1, n + offset + 2];
    if (nums.some((x) => x < 1 || x > 9)) return;
    const tiles = nums.map((x) => `${x}${suit}`);
    const next = removeTilesFromHand(tiles);
    if (!next) return alert(`チーには ${tiles.map(tileName).join("・")} が必要です`);
    setHand(next); setMelds([...melds, { type: "chi", tiles }]); setSelectedHandIndex(null); setMeldMode(null);
  }
  function makeChi(offset) { makeChiFromTile(selectedTile, offset); }
  function handleHandTileClick(index) {
    const tile = hand[index];
    if (!meldMode) {
      removeTileAt(index);
      return;
    }
    if (meldMode === "pon") makePonFromTile(tile);
    if (meldMode === "kan") makeKanFromTile(tile);
    if (meldMode === "kita") makeKitaFromTile(tile);
    if (meldMode === "chi-start") makeChiFromTile(tile, 0);
    if (meldMode === "chi-middle") makeChiFromTile(tile, -1);
    if (meldMode === "chi-end") makeChiFromTile(tile, -2);
  }

  return (
    <div className="app"><style>{styles}</style><div className="container">
      <div className="header"><div><h1>麻雀初心者スキルアップツール</h1><p>画像の牌をクリックして、シャンテン・近い役・目標役別の捨て候補を確認できます。</p></div><div className="mode-switch"><button className={mode === "4p" ? "mode-btn active" : "mode-btn"} onClick={() => changeMode("4p")}>4人麻雀</button><button className={mode === "3p" ? "mode-btn active" : "mode-btn"} onClick={() => changeMode("3p")}>3人麻雀</button></div></div>
      <div className="grid-main">
        <div className="card">
          <div className="card-header"><div className="title-with-shanten"><h2>自分の手牌</h2>{shanten && <span className="shanten-badge">{shanten.min <= -1 ? "アガリ" : shanten.min === 0 ? "テンパイ" : `${shanten.min}シャンテン`}</span>}</div><div className="inline-buttons"><span className="badge">手牌 {hand.length}枚 / 鳴き {melds.length}組</span><button className="small-btn" onClick={removeLast}>1枚戻す</button><button className="small-btn" onClick={removeSelected}>選択牌を削除</button><button className="small-btn danger" onClick={clearAll}>全消去</button></div></div>
          <div className="hand-sticky-wrap">
            <div className="sticky-hand-title">
              <span>現在の手牌</span>
              <b>{hand.length}/14枚</b>
              {hand.length === 14 && <em>右端がツモ牌</em>}
            </div>
            <TileRow tiles={hand} selectedIndex={selectedHandIndex} onTileClick={handleHandTileClick} />
          </div>
          <div className="selected-box">
            操作：<b>{meldMode ? `${meldMode === "pon" ? "ポン" : meldMode === "kan" ? "カン" : meldMode === "kita" ? "北抜き" : meldMode === "chi-start" ? "選択牌からチー" : meldMode === "chi-middle" ? "選択牌を真ん中でチー" : "選択牌を右でチー"}する牌をクリック` : "牌をクリックで削除"}</b>
            <span>{meldMode ? "鳴き登録したい牌を手牌からクリックしてください。" : "鳴きたい時は下のポン/チー/カンボタンを先に押してください。"}</span>
          </div>
          <div className="meld-box"><div className="wind-title">鳴き登録</div><div className="meld-row">
            <button className={meldMode === "pon" ? "small-btn active" : "small-btn"} onClick={() => setMeldMode(meldMode === "pon" ? null : "pon")}>ポン</button>
            {mode === "4p" && <button className={meldMode === "chi-start" ? "small-btn active" : "small-btn"} onClick={() => setMeldMode(meldMode === "chi-start" ? null : "chi-start")}>選択牌からチー</button>}
            {mode === "4p" && <button className={meldMode === "chi-middle" ? "small-btn active" : "small-btn"} onClick={() => setMeldMode(meldMode === "chi-middle" ? null : "chi-middle")}>選択牌を真ん中でチー</button>}
            {mode === "4p" && <button className={meldMode === "chi-end" ? "small-btn active" : "small-btn"} onClick={() => setMeldMode(meldMode === "chi-end" ? null : "chi-end")}>選択牌を右でチー</button>}
            <button className={meldMode === "kan" ? "small-btn active" : "small-btn"} onClick={() => setMeldMode(meldMode === "kan" ? null : "kan")}>暗カン</button>
            {mode === "3p" && <button className={meldMode === "kita" ? "small-btn active" : "small-btn"} onClick={() => setMeldMode(meldMode === "kita" ? null : "kita")}>北抜き</button>}
            {meldMode && <button className="small-btn danger" onClick={() => setMeldMode(null)}>鳴き選択をやめる</button>}
          </div><div className="note compact">通常は手牌クリックで削除。ポン/カン/北抜き、4人麻雀ではチーを押した後だけ、手牌クリックで登録します。3人麻雀モードではチーを非表示にしています。</div>{melds.length > 0 && <div className="meld-list">{melds.map((m, i) => <MeldView key={i} meld={m} canUpgradeKan={m.type === "pon" && hand.includes(m.tile)} onUpgradeKan={() => upgradePonToKan(i)} onRemove={() => setMelds(melds.filter((_, idx) => idx !== i))} />)}</div>}</div>
          <div className="wind-wrap"><div className="wind-box"><div className="wind-title">場風</div><div className="inline-buttons">{["1z","2z","3z","4z"].map((t) => <button key={t} className={roundWind === t ? "small-btn active" : "small-btn"} onClick={() => setRoundWind(t)}>{tileName(t)}</button>)}</div></div><div className="wind-box"><div className="wind-title">自風</div><div className="inline-buttons">{["1z","2z","3z","4z"].map((t) => <button key={t} className={seatWind === t ? "small-btn active" : "small-btn"} onClick={() => setSeatWind(t)}>{tileName(t)}</button>)}</div></div></div>
          <h3 className="section-title">牌を選択</h3><TilePalette mode={mode} onPick={addHand} countsLimit={visibleCounts} />
        </div>
        <div className="side-column">
          <div className="card"><h2>捨て候補ランキング</h2><div className="target-yaku">目標：<b>{selectedYaku}</b></div>{!hand.length ? <div className="muted">手牌を入力すると表示されます。</div> : <div className="list">{discardRanks.slice(0, 3).map((r, i) => <div className="rank-item" key={`${r.tile}-${i}`}><div className="rank-num">{i + 1}</div><Tile tile={r.tile} small /><div className="rank-main"><div className="item-title">{tileName(r.tile)}を切る候補</div><div className="item-sub">{r.reason}</div></div><span className={r.delta > 0 ? "badge danger" : "badge"}>{r.shantenAfter <= -1 ? "アガリ形" : r.shantenAfter === 0 ? "テンパイ" : `${r.shantenAfter}向聴`}</span></div>)}</div>}<div className="note">学習用の目安です。選んだ目標役・シャンテン・孤立牌・つながり・役牌を使って順位を出しています。</div></div>
          <div className="card"><h2>近い役（50%以上）</h2><div className="helper-text">ここで役を選ぶと、上の捨て候補ランキングがその役を目指す内容に変わります。迷ったら「最速テンパイを目指す」を選んでください。</div>{!hand.length && melds.length === 0 ? <div className="muted">手牌を入力すると表示されます。</div> : yakus.length === 0 ? <div className="muted">50%以上で近い役はまだありません。まずはシャンテン数を下げる方向で進めましょう。</div> : <div className="list"><button className={selectedYaku === "最速テンパイ" ? "yaku-select active" : "yaku-select"} onClick={() => setSelectedYaku("最速テンパイ")}>最速テンパイを目指す</button>{yakus.map((y) => <button className={selectedYaku === y.name ? "list-item yaku-select active" : "list-item yaku-select"} key={y.name} onClick={() => setSelectedYaku(y.name)}><div><div className="item-title"><span className="grade">{grade(y.score)}</span>{y.name}</div><div className="item-sub">{y.reason}</div></div><span className="badge">{Math.round(y.score * 100)}%</span></button>)}</div>}</div>
        </div>
      </div>
    
      <footer className="site-info">
        <section>
          <h2>このアプリについて</h2>
          <p>
            麻雀初心者スキルアップツールは、麻雀初心者向けの学習ツールです。牌を選択すると、シャンテン数、近い役、目標役に合わせた捨て候補を確認できます。3人麻雀・4人麻雀の練習や牌姿検討に使えます。
          </p>
        </section>

        <section>
          <h2>使い方</h2>
          <ol>
            <li>3人麻雀または4人麻雀を選びます。</li>
            <li>牌画像をクリックして、自分の手牌を入力します。</li>
            <li>14枚目はツモ牌として右端に表示されます。</li>
            <li>ポン・チー・カン・北抜きがある場合は、鳴き登録から入力します。</li>
            <li>近い役を選ぶと、その役を目指す捨て候補ランキングに切り替わります。</li>
          </ol>
        </section>

        <section>
          <h2>利用上の注意</h2>
          <p>
            本アプリは麻雀の学習・牌姿検討を目的としたツールです。オンライン対局中の外部補助、不正行為、各ゲームサービスの利用規約に反する使い方を推奨するものではありません。表示される役候補や捨て候補は学習用の目安であり、実戦での最善手を保証するものではありません。
          </p>
        </section>

        <section>
          <h2>プライバシーポリシー</h2>
          <p>
            本アプリは、現時点ではユーザー登録や個人情報の入力を必要としません。牌の入力内容は、アプリの動作や表示のためにブラウザ上で処理されます。
          </p>
          <p>
            今後、広告配信サービスを利用する場合、Googleなどの第三者配信事業者がCookie等を使用して広告を配信することがあります。ユーザーはブラウザ設定や各広告事業者の設定ページから、Cookieやパーソナライズ広告に関する設定を変更できます。
          </p>
          <p>
            アクセス解析や広告配信を導入した場合、本ページで利用サービスや取得される情報について追記します。
          </p>
        </section>

        <section>
          <h2>お問い合わせ</h2>
          <p>
            不具合報告、改善要望、削除依頼などは、X（旧Twitter）アカウント @ymm8125 までご連絡ください。
          </p>
        </section>
      </footer>
    </div></div>
  );
}

const styles = `
*{box-sizing:border-box}body{margin:0;background:#f3f6fb;font-family:Arial,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;color:#1f2937}button{font:inherit}.app{min-height:100vh;padding:16px}.container{max-width:1380px;margin:0 auto}.header{display:flex;gap:12px;justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap}.header h1{margin:0 0 6px 0;font-size:32px}.header p{margin:0;color:#6b7280}.mode-switch,.inline-buttons{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mode-btn,.small-btn{border:1px solid #cbd5e1;background:white;border-radius:10px;padding:10px 14px;cursor:pointer}.mode-btn.active,.small-btn.active{background:#2563eb;color:white;border-color:#2563eb}.small-btn{padding:6px 9px;font-size:13px}.small-btn:disabled{opacity:.4;cursor:not-allowed}.small-btn.danger{background:#ef4444;color:white;border-color:#ef4444}.grid-main{display:grid;grid-template-columns:1.45fr .95fr;gap:16px;align-items:start}.side-column{display:flex;flex-direction:column;gap:16px}.card{background:white;border-radius:18px;box-shadow:0 2px 10px rgba(0,0,0,.06);padding:16px}.card h2{margin:0 0 14px 0;font-size:22px}.card-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}.hand-sticky-wrap{margin-bottom:14px}.sticky-hand-title{display:none}.tile-row{min-height:86px;border:1px solid #e5e7eb;background:#f8fafc;border-radius:14px;padding:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px}.tsumo-tile-wrap{margin-left:18px;position:relative;display:flex;flex-direction:column;align-items:center}.tsumo-label{font-size:10px;color:#2563eb;font-weight:800;margin-top:2px}.empty-text,.muted{color:#94a3b8}.selected-box{background:#eff6ff;color:#1d4ed8;border-radius:12px;padding:8px 10px;margin-bottom:8px;font-size:13px}.selected-box span{color:#475569;margin-left:8px}.wind-wrap{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.wind-box,.meld-box{background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:8px}.meld-box{margin-bottom:10px}.wind-title,.section-title{font-weight:700;margin-bottom:6px}.wind-title{font-size:14px}.section-title{font-size:16px}.meld-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.meld-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}.meld-view{display:flex;gap:6px;align-items:center;background:white;border:1px solid #e5e7eb;border-radius:12px;padding:6px}.meld-tiles{display:flex;gap:4px}.palette-wrap{display:flex;flex-direction:column;gap:12px}.palette-group{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}.palette-label{width:40px;font-weight:700;color:#64748b;padding-top:8px}.palette-tiles{display:flex;gap:6px;flex-wrap:wrap;flex:1}.tile-btn{border:1px solid #d1d5db;background:white;border-radius:10px;padding:4px;cursor:pointer;transition:transform .12s ease;display:flex;align-items:center;justify-content:center}.tile-btn:hover{transform:scale(1.05)}.tile-btn:disabled{opacity:.35;cursor:not-allowed;transform:none}.tile-selected{box-shadow:0 0 0 3px #2563eb;background:#eff6ff}.tile-normal{width:50px;height:72px}.tile-small{width:40px;height:58px}.tile-img{width:100%;height:100%;object-fit:contain}.tile-fallback{width:100%;height:100%;border-radius:6px;background:#f8fafc;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px}.tile-fallback-main{font-size:14px;font-weight:700}.title-with-shanten{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.shanten-badge{background:#ecfdf5;border:1px solid #86efac;color:#047857;border-radius:999px;padding:7px 12px;font-size:14px;font-weight:800;white-space:nowrap}.list{display:flex;flex-direction:column;gap:10px}.list-item,.rank-item{border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:white;display:flex;gap:10px;align-items:center;justify-content:space-between}.rank-item{justify-content:flex-start}.rank-num{width:28px;text-align:center;font-size:24px;font-weight:800;color:#2563eb}.rank-main{flex:1;min-width:0}.item-title{font-weight:700}.item-sub{font-size:12px;color:#64748b;margin-top:4px}.grade{display:inline-block;width:24px}.badge{background:#e2e8f0;color:#1f2937;border-radius:999px;padding:6px 10px;font-size:12px;white-space:nowrap}.badge.danger{background:#fee2e2;color:#b91c1c}.note{margin-top:12px;border-radius:14px;padding:12px;background:#f8fafc;color:#475569;font-size:13px}.note.compact{margin-top:6px;padding:8px;font-size:12px;line-height:1.5}.yaku-select{width:100%;text-align:left;cursor:pointer}.yaku-select.active{border-color:#2563eb;background:#eff6ff;box-shadow:inset 0 0 0 2px #2563eb}.target-yaku{margin:-4px 0 12px 0;background:#eff6ff;color:#1d4ed8;border-radius:12px;padding:10px 12px;font-size:14px}.helper-text{background:#f8fafc;border:1px solid #e5e7eb;color:#475569;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.5;margin:-4px 0 12px 0}@media(max-width:1100px){.grid-main{grid-template-columns:1fr}}.site-info{margin-top:24px;background:white;border-radius:18px;box-shadow:0 2px 10px rgba(0,0,0,.06);padding:20px;display:flex;flex-direction:column;gap:18px}.site-info section{border-top:1px solid #e5e7eb;padding-top:16px}.site-info section:first-child{border-top:none;padding-top:0}.site-info h2{font-size:20px;margin:0 0 8px 0}.site-info p,.site-info li{font-size:14px;line-height:1.8;color:#475569}.site-info ol{margin:0;padding-left:20px}
@media(max-width:700px){.header h1{font-size:24px}.mini-grid,.wind-wrap{grid-template-columns:1fr}.tile-normal{width:42px;height:62px}.tile-small{width:34px;height:50px}.palette-label{width:100%;padding-top:0}.selected-box span{display:block;margin-left:0;margin-top:4px}.hand-sticky-wrap{position:sticky;top:0;z-index:30;background:white;padding:8px 0 4px 0;border-bottom:1px solid #e5e7eb}.sticky-hand-title{display:flex;align-items:center;gap:8px;margin:0 0 6px 2px;font-size:13px;color:#475569}.sticky-hand-title span{font-weight:800;color:#111827}.sticky-hand-title b{background:#ecfdf5;color:#047857;border:1px solid #86efac;border-radius:999px;padding:3px 8px;font-size:12px}.sticky-hand-title em{font-style:normal;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:3px 8px;font-size:12px}.hand-sticky-wrap .tile-row{margin-bottom:8px;max-height:132px;overflow:auto;box-shadow:0 6px 14px rgba(0,0,0,.08)}.card-header{position:sticky;top:0;z-index:31;background:white;padding-bottom:8px}.app{padding:10px}.card{padding:14px}.tile-row{gap:4px}.tsumo-tile-wrap{margin-left:12px}}
`;

export default App;
