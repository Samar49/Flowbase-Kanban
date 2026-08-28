import React, { useEffect, useState, } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, } from "recharts";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, ListTodo, } from "lucide-react";

import { analyticsApi, } from "../services/api";

const CHART_COLORS = [
  "#6D3DF5",
  "#8B5CF6",
  "#A78BFA",
  "#22C55E",
  "#F59E0B",
];

const formatMetricKey = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./,
  (character) => character.toUpperCase()
);
export default function AnalyticsView({
  projectId,
  onBack,
}) {
  const [data, setData] =
    useState(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadAnalytics =
      async () => {
        try {
          setError("");
          const response =
            await analyticsApi.get(
              projectId
            );
          setData(response.data);
        } catch (err) {
          console.error(
            "Failed to load analytics:",
            err
          );
          setError(
            err?.response?.data
              ?.error ||
            "Failed to load analytics."
          );
        }
      };
    loadAnalytics();
  }, [projectId]);
  if (error) {
    return (
      <main className="page analytics-page">
        <div className="analytics-head">
          <button
            className="back-btn"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={16} />
            Board
          </button>
          <h1>Analytics</h1>
          <p className="analytics-error">
            {error}
          </p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="page analytics-page">
        <div className="analytics-loading">
          <div className="loading-spinner" />
          <strong>
            Loading analytics
          </strong>
          <span>
            Preparing your
            project insights...
          </span>
        </div>
      </main>
    );
  }
  const overview =
    data.overview || {};

  const getMetricValue = (
    key,
    value
  ) => {
    if (
      key.includes(
        "Percentage"
      )
    ) {
      return `${value}%`;
    }
    if (
      key.includes("Hours")
    ) {
      return `${value}h`;
    }
    return value;
  };
  return (
    <main className="page analytics-page">
      <div className="analytics-head">
        <div>
          <button
            className="back-btn analytics-back"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={16} />
            Back to board
          </button>

          <div className="analytics-title-row">
            <div className="analytics-title-icon">
              <BarChart3 size={22} />
            </div>

            <div>
              <span className="modal-eyebrow">
                PROJECT INSIGHTS
              </span>

              <h1>Analytics</h1>

              <p>
                Real project data,
                not mock metrics.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {Object.entries(
          overview
        ).map(
          (
            [key, value],
            index
          ) => {
            const icons = [
              ListTodo,
              CheckCircle2,
              BarChart3,
              Clock3,
            ];

            const MetricIcon =
              icons[
              index %
              icons.length
              ];

            return (
              <div
                className="metric"
                key={key}
              >
                <div className="metric-icon">
                  <MetricIcon
                    size={17}
                  />
                </div>

                <span>
                  {formatMetricKey(
                    key
                  )}
                </span>

                <strong>
                  {getMetricValue(
                    key,
                    value
                  )}
                </strong>
              </div>
            );
          }
        )}
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div>
              <span className="chart-eyebrow">
                WORKLOAD
              </span>

              <h3>
                Tasks by status
              </h3>
            </div>
          </div>

          <ResponsiveContainer
            width="100%"
            height={280}
          >
            <BarChart
              data={
                data.byStatus ||
                []
              }
            >
              <XAxis
                dataKey="name"
              />

              <YAxis
                allowDecimals={false}
              />

              <Tooltip
                contentStyle={{
                  background:
                    "var(--kanban-surface)",
                  border:
                    "1px solid var(--kanban-border)",
                  borderRadius: 12,
                  color:
                    "var(--kanban-text)",
                }}
              />

              <Bar
                dataKey="value"
                fill="var(--kanban-purple)"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div>
              <span className="chart-eyebrow">
                DISTRIBUTION
              </span>

              <h3>
                Priority
              </h3>
            </div>
          </div>

          <ResponsiveContainer
            width="100%"
            height={280}
          >
            <PieChart>
              <Pie
                data={
                  data.byPriority ||
                  []
                }
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                innerRadius={55}
                paddingAngle={4}
                label
              >
                {(
                  data.byPriority ||
                  []
                ).map(
                  (_, index) => (
                    <Cell
                      key={`priority-${index}`}
                      fill={
                        CHART_COLORS[
                        index %
                        CHART_COLORS.length
                        ]
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip
                contentStyle={{
                  background:
                    "var(--kanban-surface)",
                  border:
                    "1px solid var(--kanban-border)",
                  borderRadius: 12,
                  color:
                    "var(--kanban-text)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card wide">
          <div className="chart-card-head">
            <div>
              <span className="chart-eyebrow">
                LAST 14 DAYS
              </span>

              <h3>
                Completion trend
              </h3>
            </div>
          </div>

          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <LineChart
              data={
                data.trend || []
              }
            >
              <XAxis
                dataKey="date"
              />

              <YAxis
                allowDecimals={false}
              />

              <Tooltip
                contentStyle={{
                  background:
                    "var(--kanban-surface)",
                  border:
                    "1px solid var(--kanban-border)",
                  borderRadius: 12,
                  color:
                    "var(--kanban-text)",
                }}
              />

              <Line
                type="monotone"
                dataKey="created"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="completed"
                stroke="#22C55E"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </main>
  );
}