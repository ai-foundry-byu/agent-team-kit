# Tending agents from afar

When you fire several agents and step away, three things make it work: **see** what they're doing, **reach** them from your phone, and **keep the machine awake** so they keep running and stay reachable. Each is a small config, set once.

## 1. Verbose — see more of what's happening

Verbose mode shows far more of each session's activity (tool calls, reasoning, what's actually running), which is what you want when you're supervising several agents or reviewing what one did while you were away.

- **Global default** (every session): set `"verbose": true` in `~/.claude/settings.json`. The `--verbose` flag overrides this per session.
- **Per session:** `claude --verbose`.

(The kit's setup sets the global default for you.)

## 2. Remote control — tend agents from the Claude app

Remote control links a session to the Claude app/web, so a running session shows up there and you can read it and send messages from your phone while away from the computer.

- **The kit's launchers do this by default.** `wt`, `cs`, and `cockpit` all pass `--remote-control`, so every session you start the normal way is reachable in the app.
- **A plain session:** `claude --remote-control`. Optionally name the remote session prefix with `--remote-control-session-name-prefix <prefix>` (defaults to your hostname).
- **Requirement:** you must be signed in to Claude for the session to appear in the app. If it's ever noisy for a one-off, drop the flag for that session.

So the loop is: start agents with the launchers → walk away → open the Claude app on your phone → watch and nudge them as needed.

## 3. Keep your computer awake (so agents keep running and stay reachable)

The goal: when you walk away, the **screen can dim or sleep** (saves power, and it's private) but the **computer stays on**, so your agents keep working and remote control stays connected. Plugged in, this is a one-time setting; unplugged, use a caffeinate-style tool.

### macOS

- **Persistent (plugged in):** System Settings → Battery → **Options…** → turn ON **"Prevent automatic sleeping on power adapter when the display is off."** The display still sleeps and dims; the Mac stays awake while on power.
  - CLI equivalent: `sudo pmset -c disablesleep 1` (or the gentler `sudo pmset -c sleep 0`). `-c` = on the power adapter. Undo with `sudo pmset -c disablesleep 0` (or restore your sleep minutes).
- **Ad-hoc / on battery:** `caffeinate -i` in a spare terminal keeps the *system* awake while letting the *display* sleep — exactly "screen dims, Mac stays on." Ctrl-C to stop, or time-limit it: `caffeinate -i -t 7200` (2 hours). It works unplugged too (it'll drain the battery).
- **Lid:** closing the lid sleeps the Mac regardless of the above. Keep the lid **open** while away, or run in clamshell mode with external power + display.

### Windows

- **Persistent (plugged in):** Settings → System → **Power & battery** → **Screen and sleep** → set **"When plugged in, put my device to sleep after"** to **Never**. Keep **"turn off my screen after"** at a few minutes so the screen still dims.
  - CLI equivalent: `powercfg /change standby-timeout-ac 0` (never sleep on AC) and `powercfg /change monitor-timeout-ac 10` (screen off after 10 min). Undo by setting `standby-timeout-ac` back to your preferred minutes.
- **Lid:** Settings → System → Power → **"When I close the lid"** (plugged in) → **Do nothing**, to keep running with the lid closed.
- **Ad-hoc caffeinate-equivalent:** **PowerToys Awake** (part of Microsoft PowerToys) — toggle "keep awake," and optionally keep the screen on or let it turn off. It's the closest thing to `caffeinate`. (The older standalone *Caffeine* app also works.)

---

**Putting it together:** verbose on globally, the launchers handle remote control, set the plugged-in keep-awake once, and keep `caffeinate -i` / PowerToys Awake in your back pocket for when you're on battery. Then you can start a fleet of named agents, walk away, and tend them from your phone.
