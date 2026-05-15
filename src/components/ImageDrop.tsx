import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';

type Props = {
  onFile: (file: File) => void;
  hasImage: boolean;
};

export function ImageDrop({ onFile, hasImage }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${over ? '#0a84ff' : '#888'}`,
        borderRadius: 8,
        padding: 16,
        textAlign: 'center',
        cursor: 'pointer',
        background: over ? '#eaf3ff' : '#fafafa',
        fontSize: 13,
        color: '#444',
      }}
    >
      {hasImage ? 'Drop nyt billede eller klik for at skifte' : 'Drop billede her eller klik for at vælge'}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
}
