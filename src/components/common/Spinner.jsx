
export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div className={`spinner spinner-${size} ${className}`}>
      <div className="spinner-ring" />
    </div>
  );
}
