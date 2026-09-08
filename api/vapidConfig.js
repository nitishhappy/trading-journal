// TradeLog VAPID Configuration for Web Push Protocol (RFC 8291 / RFC 8292)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BJ6MUAFgyMffeg6HKfdXFhhuzVG6oga2wT4gBuPJgJtsNBIOEQBgIcMUwo-XuRvGjI9Ab48Xicaup4qO7fb5Z4o";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "puZQDBjE_YAk9RNSrfHIhvxuncRNcukURBLD5kLTUNk";
const VAPID_SUBJECT = "mailto:admin@tradelog.app";

module.exports = {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT
};
