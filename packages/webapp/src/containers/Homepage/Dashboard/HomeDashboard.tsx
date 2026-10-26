import {
  Button,
  ButtonGroup,
  Classes,
  NonIdealState,
  Spinner,
} from '@blueprintjs/core';
import moment from 'moment';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styled from 'styled-components';
import type { GetDashboardInsightsResponse } from '@bigcapital/sdk-ts';
import { useDashboardInsights } from '@/hooks/query';
import { useIsDarkMode } from '@/hooks/useDarkMode';
import { formattedAmount } from '@/utils';

const PERIODS = [6, 12, 24];

/**
 * Chart colors that read well in the light and dark themes.
 */
function useChartColors() {
  const isDark = useIsDarkMode();

  return {
    received: isDark ? '#3DCC91' : '#1C9E5B',
    spent: isDark ? '#FF7373' : '#D0393E',
    balance: isDark ? '#48AFF0' : '#2563C9',
    grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(16, 22, 26, 0.08)',
    axis: isDark ? '#A7B6C2' : '#5C7080',
    tooltipBg: isDark ? '#30404D' : '#FFFFFF',
    tooltipBorder: isDark ? '#394B59' : '#D3D8DE',
    categories: isDark
      ? [
          '#48AFF0',
          '#3DCC91',
          '#FFB366',
          '#FF7373',
          '#C274C2',
          '#2EE6D6',
          '#D1F26D',
          '#8A9BA8',
        ]
      : [
          '#2563C9',
          '#1C9E5B',
          '#D9822B',
          '#D0393E',
          '#8F398F',
          '#00998C',
          '#87A629',
          '#738694',
        ],
  };
}

const monthLabel = (month: string) => moment(month, 'YYYY-MM').format('MMM YY');

/**
 * Compact axis labels: 1.2M, 85K.
 */
const compactAmount = (value: number) => {
  const abs = Math.abs(value);
  const trim = (n: number) => Number(n.toFixed(1)).toString();
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 100_000) return `${Math.round(value / 1_000)}K`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  return `${Math.round(value)}`;
};

/**
 * The homepage dashboard: money received and spent, cash balance and
 * spending by category (cash basis).
 */
export function HomeDashboard() {
  const [months, setMonths] = useState(12);
  const { data, isLoading, isError } = useDashboardInsights(months);

  return (
    <DashboardRoot data-testId="home-dashboard">
      <HeaderRow>
        <div>
          <h2 className={Classes.HEADING}>Money in and out</h2>
          <Muted>Cash and bank accounts, last {months} months.</Muted>
        </div>
        <HeaderActions>
          <ButtonGroup>
            {PERIODS.map((period) => (
              <Button
                key={period}
                small
                active={months === period}
                onClick={() => setMonths(period)}
              >
                {period}m
              </Button>
            ))}
          </ButtonGroup>
          <Link to={'/shortcuts'}>
            <Button small minimal icon={'grid-view'}>
              Shortcuts
            </Button>
          </Link>
        </HeaderActions>
      </HeaderRow>

      {isLoading ? (
        <Spinner size={30} />
      ) : isError || !data ? (
        <NonIdealState
          icon={'error'}
          title={'The dashboard could not load'}
          description={<Link to={'/shortcuts'}>Go to the shortcuts</Link>}
        />
      ) : (
        <DashboardBody data={data} />
      )}
    </DashboardRoot>
  );
}

function DashboardBody({ data }: { data: GetDashboardInsightsResponse }) {
  const colors = useChartColors();
  const money = (value: number) => formattedAmount(value, data.currencyCode);
  const { summary } = data;
  const tooltipStyle = {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: 4,
  };

  return (
    <>
      <Tiles>
        <Tile
          title={'Received this month'}
          value={money(summary.received)}
          color={colors.received}
        />
        <Tile
          title={'Spent this month'}
          value={money(summary.spent)}
          color={colors.spent}
        />
        <Tile
          title={'Net this month'}
          value={money(summary.net)}
          color={summary.net >= 0 ? colors.received : colors.spent}
        />
        <Tile
          title={'Cash and bank balance'}
          value={money(summary.cashBalance)}
        />
        <Tile
          title={'Owed to you'}
          value={money(summary.receivable)}
          link={'/invoices'}
        />
        <Tile
          title={'You owe'}
          value={money(summary.payable)}
          link={'/bills'}
        />
      </Tiles>

      <Grid>
        <Panel $wide>
          <PanelTitle>
            Received vs spent
            <Muted>
              {money(summary.totalReceived)} in · {money(summary.totalSpent)}{' '}
              out
            </Muted>
          </PanelTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthly} barGap={2}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={{ fill: colors.axis, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={compactAmount}
                tick={{ fill: colors.axis, fontSize: 12 }}
                width={48}
              />
              <Tooltip
                cursor={{ fill: colors.grid }}
                contentStyle={tooltipStyle}
                labelFormatter={(label) => monthLabel(String(label))}
                formatter={(value: number, name: string) => [
                  money(value),
                  name,
                ]}
              />
              <Legend />
              <Bar
                name="Received"
                dataKey="received"
                fill={colors.received}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                name="Spent"
                dataKey="spent"
                fill={colors.spent}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <PanelTitle>Cash and bank balance</PanelTitle>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.balanceTrend}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={{ fill: colors.axis, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={compactAmount}
                tick={{ fill: colors.axis, fontSize: 12 }}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => monthLabel(String(label))}
                formatter={(value: number) => [money(value), 'Balance']}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke={colors.balance}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <PanelTitle>Spending by category</PanelTitle>
          {data.spendingByCategory.length === 0 ? (
            <NonIdealState
              icon={'pie-chart'}
              description={'No spending in this period.'}
            />
          ) : (
            <CategoryLayout>
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={data.spendingByCategory}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={1}
                    stroke="none"
                  >
                    {data.spendingByCategory.map((category, index) => (
                      <Cell
                        key={category.name}
                        fill={
                          colors.categories[index % colors.categories.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [
                      money(value),
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <CategoryList>
                {data.spendingByCategory.map((category, index) => (
                  <li key={category.name}>
                    <Swatch
                      style={{
                        background:
                          colors.categories[index % colors.categories.length],
                      }}
                    />
                    <span className="name">{category.name}</span>
                    <span className="amount">{money(category.amount)}</span>
                  </li>
                ))}
              </CategoryList>
            </CategoryLayout>
          )}
        </Panel>
      </Grid>
    </>
  );
}

function Tile({
  title,
  value,
  color,
  link,
}: {
  title: string;
  value: string;
  color?: string;
  link?: string;
}) {
  const content = (
    <TileCard className={Classes.CARD}>
      <Muted>{title}</Muted>
      <TileValue style={color ? { color } : undefined}>{value}</TileValue>
    </TileCard>
  );
  return link ? <TileLink to={link}>{content}</TileLink> : content;
}

const DashboardRoot = styled.div`
  padding: 22px 32px;
  max-width: 1280px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;

  h2 {
    margin: 0 0 4px;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Muted = styled.div`
  font-size: 12px;
  opacity: 0.7;
`;

const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
`;

const TileCard = styled.div`
  padding: 14px 16px;
  height: 100%;
`;

const TileLink = styled(Link)`
  && {
    text-decoration: none;
    color: inherit;
  }

  &&:hover > div {
    filter: brightness(1.08);
  }
`;

const TileValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  margin-top: 6px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 960px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Panel = styled.div.attrs({ className: Classes.CARD })<{
  $wide?: boolean;
}>`
  padding: 16px;
  grid-column: ${(props) => (props.$wide ? '1 / -1' : 'auto')};
`;

const PanelTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 12px;
`;

const CategoryLayout = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CategoryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  font-size: 13px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .amount {
    font-variant-numeric: tabular-nums;
  }
`;

const Swatch = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
`;
