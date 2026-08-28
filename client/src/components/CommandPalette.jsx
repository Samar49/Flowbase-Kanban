import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Command,
  Search,
  BarChart3,
  Plus,
  Sun,
  CalendarDays,
  Download,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from "lucide-react";

export default function CommandPalette({
  onNewTask,
  onAnalytics,
  onTheme,
  onExport,
}) {
  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        setOpen(true);
        setQuery("");
        setSelectedIndex(0);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, []);

  const commands = useMemo(
    () => [
      {
        name: "Create new task",
        icon: Plus,
        action: onNewTask,
      },
      {
        name: "Open analytics",
        icon: BarChart3,
        action: onAnalytics,
      },
      {
        name: "Toggle theme",
        icon: Sun,
        action: onTheme,
      },
      {
        name: "Export project",
        icon: Download,
        action: onExport,
      },
      {
        name: "Open calendar",
        icon: CalendarDays,
        action: () =>
          window.alert(
            "Calendar view is ready for due-date planning."
          ),
      },
    ],
    [
      onNewTask,
      onAnalytics,
      onTheme,
      onExport,
    ]
  );

  const filteredCommands =
    commands.filter((command) =>
      command.name
        .toLowerCase()
        .includes(query.toLowerCase())
    );

  useEffect(() => {
    setSelectedIndex((current) =>
      Math.min(
        current,
        Math.max(
          filteredCommands.length - 1,
          0
        )
      )
    );
  }, [filteredCommands.length]);

  const executeCommand = (command) => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);

    if (
      typeof command.action ===
      "function"
    ) {
      command.action();
    }
  };

  const handleInputKeyDown = (
    event
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      setSelectedIndex((current) =>
        Math.min(
          current + 1,
          Math.max(
            filteredCommands.length - 1,
            0
          )
        )
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setSelectedIndex((current) =>
        Math.max(current - 1, 0)
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const command =
        filteredCommands[
          selectedIndex
        ];

      if (command) {
        executeCommand(command);
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="overlay command-overlay"
      onClick={() => setOpen(false)}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="palette-search">
          <Search
            size={18}
            aria-hidden="true"
          />

          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(
                event.target.value
              );

              setSelectedIndex(0);
            }}
            onKeyDown={
              handleInputKeyDown
            }
            placeholder="Search or execute command..."
            aria-label="Search commands"
          />

          <kbd>ESC</kbd>
        </div>

        <div className="command-list">
          {filteredCommands.length ===
          0 ? (
            <div className="empty-command">
              <Search size={18} />
              <span>
                No commands found
              </span>
            </div>
          ) : (
            filteredCommands.map(
              (command, index) => {
                const Icon =
                  command.icon;

                const selected =
                  index ===
                  selectedIndex;

                return (
                  <button
                    key={command.name}
                    type="button"
                    className={
                      selected
                        ? "command-item command-selected"
                        : "command-item"
                    }
                    onMouseEnter={() =>
                      setSelectedIndex(
                        index
                      )
                    }
                    onClick={() =>
                      executeCommand(
                        command
                      )
                    }
                  >
                    <span className="command-icon">
                      <Icon size={17} />
                    </span>

                    <span>
                      {command.name}
                    </span>

                    {selected ? (
                      <CornerDownLeft
                        size={14}
                      />
                    ) : (
                      <Command
                        size={14}
                      />
                    )}
                  </button>
                );
              }
            )
          )}
        </div>

        <div className="palette-hint">
          <span>
            <ArrowUp size={12} />
            <ArrowDown size={12} />
            Navigate
          </span>

          <span>
            <CornerDownLeft size={12} />
            Execute
          </span>

          <span>
            <kbd>Ctrl K</kbd>
            Anytime
          </span>
        </div>
      </div>
    </div>
  );
}