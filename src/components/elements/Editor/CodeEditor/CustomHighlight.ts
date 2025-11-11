import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const getHighlightStyle = (theme: string) => {
  const styles =
    theme === 'dark'
      ? [
          {
            tag: tags.function(tags.variableName),
            color: '#4EC9B0',
            fontWeight: 'bold',
          },
          {
            tag: tags.definition(tags.function(tags.variableName)),
            color: '#DCDCAA',
          },
          { tag: tags.keyword, color: '#C586C0', fontWeight: 'bold' },
          { tag: tags.typeName, color: '#4EC9B0' },
          { tag: tags.standard(tags.typeName), color: '#569CD6' },
          { tag: tags.variableName, color: '#9CDCFE' },
          { tag: tags.local(tags.variableName), color: '#9CDCFE' },
          { tag: tags.comment, color: '#6A9955', fontStyle: 'italic' },
          { tag: tags.docComment, color: '#608B4E', fontStyle: 'italic' },
          { tag: tags.string, color: '#CE9178' },
          { tag: tags.character, color: '#CE9178' },
          { tag: tags.special(tags.string), color: '#D7BA7D' },
          { tag: tags.number, color: '#B5CEA8' },
          { tag: tags.integer, color: '#B5CEA8' },
          { tag: tags.float, color: '#B5CEA8' },
          { tag: tags.operator, color: '#D4D4D4' },
          { tag: tags.arithmeticOperator, color: '#D4D4D4' },
          { tag: tags.logicOperator, color: '#D4D4D4' },
          { tag: tags.bitwiseOperator, color: '#D4D4D4' },
          { tag: tags.bracket, color: '#FFD700' },
          { tag: tags.paren, color: '#FFD700' },
          { tag: tags.squareBracket, color: '#FFD700' },
          { tag: tags.meta, color: '#569CD6' },
          { tag: tags.macroName, color: '#C586C0' },
          { tag: tags.constant(tags.variableName), color: '#4FC1FF' },
          { tag: tags.bool, color: '#569CD6' },
          { tag: tags.namespace, color: '#4EC9B0' },
          { tag: tags.className, color: '#4EC9B0' },
          { tag: tags.modifier, color: '#569CD6' },
          { tag: tags.attributeName, color: '#9CDCFE' },
        ]
      : [
          {
            tag: tags.function(tags.variableName),
            color: '#2b6cb0',
            fontWeight: 'bold',
          },
          {
            tag: tags.definition(tags.function(tags.variableName)),
            color: '#6b46c1',
          },
          { tag: tags.keyword, color: '#805ad5', fontWeight: 'bold' },
          { tag: tags.typeName, color: '#2b6cb0' },
          { tag: tags.standard(tags.typeName), color: '#3182ce' },
          { tag: tags.variableName, color: '#2c5282' },
          { tag: tags.local(tags.variableName), color: '#2c5282' },
          { tag: tags.comment, color: '#4a5568', fontStyle: 'italic' },
          { tag: tags.docComment, color: '#718096', fontStyle: 'italic' },
          { tag: tags.string, color: '#c53030' },
          { tag: tags.character, color: '#c53030' },
          { tag: tags.special(tags.string), color: '#744210' },
          { tag: tags.number, color: '#0f766e' },
          { tag: tags.integer, color: '#0f766e' },
          { tag: tags.float, color: '#0f766e' },
          { tag: tags.operator, color: '#2d3748' },
          { tag: tags.arithmeticOperator, color: '#2d3748' },
          { tag: tags.logicOperator, color: '#2d3748' },
          { tag: tags.bitwiseOperator, color: '#2d3748' },
          { tag: tags.bracket, color: '#d69e2e' },
          { tag: tags.paren, color: '#d69e2e' },
          { tag: tags.squareBracket, color: '#d69e2e' },
          { tag: tags.meta, color: '#805ad5' },
          { tag: tags.macroName, color: '#805ad5' },
          { tag: tags.constant(tags.variableName), color: '#3182ce' },
          { tag: tags.bool, color: '#805ad5' },
          { tag: tags.namespace, color: '#2b6cb0' },
          { tag: tags.className, color: '#2b6cb0' },
          { tag: tags.modifier, color: '#805ad5' },
          { tag: tags.attributeName, color: '#2c5282' },
        ];

  return HighlightStyle.define(styles);
};
