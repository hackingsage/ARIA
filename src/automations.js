const cron = require('node-cron');
const db = require('./database');

const activeJobs = new Map();
let chatHandler = null;

function setChatHandler(handler) {
  chatHandler = handler;
}

function startAllAutomations() {
  const automations = db.getAutomations();
  for (const auto of automations) {
    if (auto.enabled) {
      scheduleAutomation(auto);
    }
  }
  console.log(`[Automations] Loaded ${automations.filter(a => a.enabled).length} active automations`);
}

function scheduleAutomation(automation) {
  if (activeJobs.has(automation.id)) {
    activeJobs.get(automation.id).stop();
  }

  if (!cron.validate(automation.cron_expression)) {
    console.error(`[Automations] Invalid cron: ${automation.cron_expression} for "${automation.name}"`);
    return;
  }

  const job = cron.schedule(automation.cron_expression, async () => {
    console.log(`[Automations] Running: ${automation.name}`);
    try {
      const payload = automation.action_payload;
      let result;

      if (automation.action_type === 'chat' && chatHandler) {
        result = await chatHandler(payload);
      } else {
        result = { note: 'No handler for action type: ' + automation.action_type };
      }

      db.updateAutomation(automation.id, {
        last_run: new Date().toISOString(),
        last_result: JSON.stringify({ success: true, result: typeof result === 'string' ? result : JSON.stringify(result) })
      });
    } catch (err) {
      db.updateAutomation(automation.id, {
        last_run: new Date().toISOString(),
        last_result: JSON.stringify({ success: false, error: err.message })
      });
    }
  });

  activeJobs.set(automation.id, job);
}

function stopAutomation(id) {
  if (activeJobs.has(id)) {
    activeJobs.get(id).stop();
    activeJobs.delete(id);
  }
}

function refreshAutomation(id) {
  const automation = db.getAutomation(id);
  if (!automation) {
    stopAutomation(id);
    return;
  }
  if (automation.enabled) {
    scheduleAutomation(automation);
  } else {
    stopAutomation(id);
  }
}

function stopAll() {
  for (const [id, job] of activeJobs) {
    job.stop();
  }
  activeJobs.clear();
}

module.exports = { startAllAutomations, scheduleAutomation, stopAutomation, refreshAutomation, stopAll, setChatHandler };
