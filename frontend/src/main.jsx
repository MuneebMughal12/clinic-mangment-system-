import { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./theme.css";
import "./dark-theme.css";

class StartupErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Clinic Desk renderer failed to start:", error);
  }

  render() {
    if (this.state.error) {
      return <div className="startup-error">
        <h1>Clinic Desk could not open</h1>
        <p>{this.state.error.message}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StartupErrorBoundary><App /></StartupErrorBoundary>,
);
