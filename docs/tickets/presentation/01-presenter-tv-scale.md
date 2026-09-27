# 01: Presenter TV scale

**What to build:** The presenter app (Worklist, Episode workspace, QR overlay) reads comfortably on a big TV. All presenter text is scaled up from the root (about 150%, always on) and the Episode screen fits a 1920×1080 viewport without page scroll. Fixed pixel font sizes that ignore the root scale are replaced with scalable sizes. The phone app is unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Presenter body text renders around 24px at 1920×1080; the phone builder and result pages keep their current sizes.
- [ ] No presenter text uses fixed pixel font sizes that bypass the root scale.
- [ ] Typecheck, lint and unit tests pass.

Tracker: https://github.com/ali31com/version1/issues/15
