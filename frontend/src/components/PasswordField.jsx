import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({ label, wide = false, ...inputProps }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={`field password-field${wide ? " wide" : ""}`}>
      <label htmlFor={id}><span>{label}</span></label>
      <div className="password-input">
        <input id={id} type={visible ? "text" : "password"} {...inputProps} />
        <button
          className="password-visibility"
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
