// A document as a page: the photo when it was scanned, otherwise the saved note laid out like the paper it came
// from. Also the small thumbnail of it that sits in the record's list.
import type { RecordDoc } from "../lib/types";
import { loadDocFile } from "../lib/edits";
import { Sheet } from "./bits";
import Icon from "./Icon";

export function DocThumb({ doc }: { doc: RecordDoc }) {
  const file = loadDocFile(doc.id);
  return (
    <span className={`doc-thumb ${doc.kind}`} aria-hidden>
      {file?.image ? (
        <img src={file.image} alt="" />
      ) : (
        <span className="paper-mini">
          <b />
          <i />
          <i />
          <i className="short" />
          <i />
          <i className="short" />
        </span>
      )}
    </span>
  );
}

export default function DocPreview({ doc, onClose }: { doc: RecordDoc; onClose: () => void }) {
  const file = loadDocFile(doc.id);
  return (
    <Sheet title={{ visit: "Visit", imaging: "Imaging", document: "Document" }[doc.kind] || "Document"} onClose={onClose}>
      {file?.image && <img className="doc-photo" src={file.image} alt={`Photo of ${doc.title}`} />}
      <article className="paper">
        <header>
          {doc.facility && (
            <span className="paper-place">
              <Icon name="pin" size={16} />
              {doc.facility}
            </span>
          )}
          {doc.date && <time>{doc.date}</time>}
        </header>
        <h4>{doc.title}</h4>
        {doc.body
          .split(/\n+/)
          .filter(Boolean)
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </article>
      {file?.text && (
        <details className="paper-text">
          <summary>Text read from the photo</summary>
          <pre>{file.text}</pre>
        </details>
      )}
    </Sheet>
  );
}
