export default function DocumentSelector({
  documents,
  selectedDocument,
  onSelect,
}) {
  return (
    <select
      value={selectedDocument}
      onChange={(e) => onSelect(e.target.value)}
    >
      <option value="">
        Select teacher material
      </option>

      {documents.map((doc) => (
        <option
          key={doc.documentId}
          value={doc.documentId}
        >
          {doc.fileName}
        </option>
      ))}
    </select>
  );
}