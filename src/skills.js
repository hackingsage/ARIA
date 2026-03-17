const vm = require('vm');
const db = require('./database');
const { executeTool } = require('./tools');

async function runSkill(skillName) {
  const skill = db.getSkillByName(skillName);
  if (!skill) {
    return { success: false, error: `Skill not found: ${skillName}` };
  }

  try {
    const context = {
      console: {
        log: (...args) => output.push(args.join(' ')),
        error: (...args) => errors.push(args.join(' '))
      },
      executeTool,
      require: () => { throw new Error('require is not allowed in skills'); },
      setTimeout: () => { throw new Error('setTimeout is not allowed in skills'); },
      result: null
    };

    const output = [];
    const errors = [];

    const wrappedCode = `
      (async () => {
        ${skill.code}
      })().then(r => { result = r; }).catch(e => { result = { error: e.message }; });
    `;

    const script = new vm.Script(wrappedCode, { timeout: 30000 });
    const sandbox = vm.createContext(context);
    script.runInContext(sandbox);

    // Wait a tick for async
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      skill: skill.name,
      output: output.join('\n'),
      errors: errors.length > 0 ? errors.join('\n') : undefined,
      result: context.result
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { runSkill };
