const path = require('path');
const { math, emptyForm, mergeForms } = require('../utils');

const parseF1040s2 = (input, output) => {
  const mappings = require(`../mappings/${path.basename(__filename, '.js')}.json`)
  const f1040s2 = mergeForms(mergeForms(emptyForm(mappings), input.f1040s2), output.f1040s2);

  return [f1040s2]
}

module.exports = { parseF1040s2 }
