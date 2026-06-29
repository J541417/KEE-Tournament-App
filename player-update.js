document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("playerUpdateForm");
  const submitBtn = document.getElementById("submitUpdateBtn");
  const messageBox = document.getElementById("updateMessage");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    messageBox.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const payload = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      cellPhone: document.getElementById("cellPhone").value.trim(),
      email: document.getElementById("email").value.trim(),
      birthdate: document.getElementById("birthdate").value,
      nextGolfDate: document.getElementById("nextGolfDate").value
    };

    try {
      const response = await fetch("/api/update-player-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update information.");
      }

      messageBox.textContent = "Success! Your information has been updated.";
      messageBox.style.background = "#ecf7ef";
      messageBox.style.color = "var(--primary-dark)";
      messageBox.classList.remove("hidden");
      
      form.reset();
    } catch (error) {
      messageBox.textContent = error.message;
      messageBox.style.background = "var(--danger-bg)";
      messageBox.style.color = "var(--danger-text)";
      messageBox.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save My Information";
    }
  });
});
