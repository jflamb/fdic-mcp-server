document.addEventListener("DOMContentLoaded", () => {
  const codeBlocks = document.querySelectorAll(".doc-content pre");

  codeBlocks.forEach((block) => {
    const code = block.querySelector("code");
    if (!code) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    const toolbar = document.createElement("div");
    toolbar.className = "code-block__toolbar";
    wrapper.insertBefore(toolbar, block);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code block");
    toolbar.appendChild(button);

    button.addEventListener("click", async () => {
      const content = code.innerText;

      try {
        await navigator.clipboard.writeText(content);
        button.textContent = "Copied";
      } catch {
        button.textContent = "Press Ctrl/Cmd+C";
      }

      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 1800);
    });
  });
});
