import { createMemo, type Accessor, type Component } from 'solid-js';
import { highlightCode } from '../lib/syntax';
import { normalizeFrontmatterContent } from '../lib/frontmatter';

type FrontmatterEditorProps = {
  value: Accessor<string>;
  onChange: (value: string) => void;
};

const FrontmatterEditor: Component<FrontmatterEditorProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  let mirrorRef: HTMLPreElement | undefined;

  const highlighted = createMemo(() => highlightCode(props.value(), 'yaml').html);

  const handleInput = (event: InputEvent) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    props.onChange(normalizeFrontmatterContent(target.value));
    syncScroll();
  };

  const syncScroll = () => {
    if (mirrorRef && textareaRef) {
      mirrorRef.scrollTop = textareaRef.scrollTop;
      mirrorRef.scrollLeft = textareaRef.scrollLeft;
    }
  };

  return (
    <div class="frontmatter-editor">
      <div class="frontmatter-editor__header">
        <p>Frontmatter</p>
        <span>YAML</span>
      </div>
      <div class="frontmatter-editor__surface">
        <pre class="frontmatter-editor__highlight" aria-hidden="true" ref={(node) => (mirrorRef = node ?? undefined)}>
          {/* eslint-disable-next-line solid/no-innerhtml */}
          <code class="language-yaml" innerHTML={highlighted()} />
        </pre>
        <textarea
          ref={(node) => {
            textareaRef = node ?? undefined;
          }}
          value={props.value()}
          onInput={handleInput}
          onScroll={syncScroll}
          spellcheck={false}
          aria-label="Frontmatter editor"
        />
      </div>
    </div>
  );
};

export default FrontmatterEditor;
