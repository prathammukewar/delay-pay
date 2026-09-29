# Delay Pay

Your flight was late, cancelled or overbooked. Delay Pay tells you in about 30 seconds what the airline owes you, then writes the claim letter so you can send it yourself instead of handing a claim company a quarter to half of the money.

Live: https://prathammukewar.github.io/delay-pay/

## What it checks

- EU261 (Regulation 261/2004) covers flights leaving the EU, Iceland, Norway or Switzerland on any airline, and flights into the EU on an EU airline. The checker applies the €250, €400 and €600 distance bands, the 3-hour arrival delay rule from Sturgeon, the 50% cuts, the cancellation notice windows, denied boarding, downgrades, extraordinary circumstances and the right to care. A reform was signed in September 2026 but isn't in force yet, so the 2004 rules apply.
- UK261 is the UK's retained version, paying £220, £350 or £520.
- Canada's APPR pays C$400 to C$1,000 for delays within a large airline's control, C$125 to C$500 on small airlines, and C$900 to C$2,400 for being bumped.
- The US DOT rules pay no cash for delays. You get a refund for cancellations and big schedule changes under the 2024 rule, and bump pay of 200% or 400% of your fare, capped at $1,075 and $2,150.

Each rule in `js/rules.js` names its source and the month it was last checked. Rules were last checked in September 2026.

It also gives you the enforcement body or complaint route to use if the airline says no, and a share card with the amount and nothing personal on it.

## Not legal advice

This is general information. Your case can turn on details the checker can't see, so if a lot of money is riding on it, talk to your country's enforcement body or a lawyer.

## Privacy

There's no server. The checker, the letter and the share image all run in your browser, and nothing you type leaves the page unless you send the email yourself.

## Run it locally

No build step and no dependencies.

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. Run the tests with:

```sh
node test/test.mjs
```

Optional analytics: put a GoatCounter code in `GOATCOUNTER` in `js/config.js`. It stays off when that's empty.

## Credits

Airport data comes from [OurAirports](https://ourairports.com/data/), which is in the public domain. Fonts are Archivo and IBM Plex Mono from Google Fonts.

## License

MIT. See [LICENSE](LICENSE).
