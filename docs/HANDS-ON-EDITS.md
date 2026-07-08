# Editing by hand (the human keyboard path)

The rest of the kit is about **agents** doing the work: dispatching them, [driving the app](./DRIVING-THE-APP.md), keeping them from colliding on `main`. But sometimes it is just faster to take the keyboard yourself, a copy tweak, a one-line fix, a spacing change you can see, than to write a prompt and wait for an agent to land it. This is the sibling to `DRIVING-THE-APP.md`: that doc is *Claude drives the app*, this is *you go from "I see this on screen" to "edited and committed" in a few seconds*.

Two frictions stand between you and a fast manual edit, and the kit's shared-`main` hazards apply to both. Close them once and the loop is: see it, jump to it, change it, commit only it.

## 1. From screen to source in one click

The problem: you can see the element in the running app, but not which file renders it. Compiled front ends erase that link, the rendered HTML carries no path back to the source, so grepping a visible label is the fallback. The better answer is your framework's **inspector**: hold a key, hover any element, and it labels the exact source file and line; click, and it opens that file in your editor at the line.

Enable it **dev-only and per-person**, so it never ships and never lands in shared config. Most inspectors read their toggle from an env var, so the natural home is your gitignored `.env.local`:

| Stack | Inspector | Enable (personal) |
|---|---|---|
| Svelte / SvelteKit (Vite) | `@sveltejs/vite-plugin-svelte` built-in inspector | `.env.local`: `SVELTE_INSPECTOR_OPTIONS={"toggleKeyCombo":"meta-shift","showToggleButton":"never"}` |
| React (Vite) | `click-to-react-component`, or React DevTools "view source" | hold `Alt`/`Option` and click an element |
| Vue (Vite) | `vite-plugin-vue-inspector` (or Vue DevTools "Open in Editor") | toggle key, defaults to `meta-shift` |

For the Svelte case above: restart the dev server (the inspector wires in at startup), open a `localhost:<port>` tab served by *your* dev server (not a deployed URL or a static file), then hold the toggle keys and hover. The overlay names the `.svelte` file; clicking opens it.

**The one prerequisite for click-to-open: your editor's CLI has to be on `PATH`.** Click-to-open shells out to it (`code` for VS Code, `cursor`, `webstorm`, ...). If a click does nothing but the overlay works, that is the missing piece. In VS Code: Command Palette, "Shell Command: Install 'code' command in PATH". Verify in a **fresh** terminal (`which code`), an already-open shell has the old `PATH` and will not see it, which includes the terminal your dev server is running in, so restart the server from a new shell after installing.

Leaving the inspector on permanently is safe: it is compiled out of production builds, and idle until you actually hold the toggle key, so there is no runtime cost to users and no measurable dev cost to you.

## 2. Commit only the file you touched (the GUI trap)

On a shared `main` the standing rule is [stage explicit paths, never blanket-stage](./CONVENTIONS.md#commits), because a blanket stage sweeps in whatever a sibling agent left in the working tree. The kit's `bash-guard` enforces that at the CLI: it refuses `git add -A`, `git add .`, and `git commit -am`.

**The editor GUI has no such guard, and its default behavior is exactly the hazard the CLI blocks.** In VS Code, clicking **Commit** with *nothing staged* commits *every* changed file in the tree, the GUI form of `git commit -a`. With several agents mid-task, that is a dozen files that are not yours, in one commit.

So when you edit by hand and commit from the editor, the discipline is manual, because nothing enforces it for you:

1. In Source Control, hover the row for **your** file and click the **`+`** (Stage Changes). It moves into a **Staged Changes** section.
2. Only then type your message (conventional prefix, one concern) and click **Commit**. With something staged, Commit acts on the staged set only.
3. Never click **Commit** with an empty stage, that is the commit-everything path.

Belt and suspenders: turn off `git.enableSmartCommit` in Settings so the editor never offers to "commit all" when nothing is staged, removing the trap entirely. The equivalent CLI form, when you would rather stay in the shell, is `git commit -m "..." -- path/to/file` (flags before `--`, paths after), which commits only the named paths regardless of what else is staged.

Then stop, do not push. Pushing stays a deliberate human act (see the kit's `push` skill and pre-push gate); the editor's "Sync Changes" button is not your cue.

---

Together these two fixes make the manual path as safe as the agent path: the inspector gets you to the right file without a hunt, and the single-file-stage discipline keeps your quick edit from swallowing a sibling's in-flight work. Same shared-`main` principles as the rest of the kit, applied to the moment *you* are the one typing.
