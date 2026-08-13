import chalk from 'chalk';

function vulnStr(v) {
  if (!v) return '-';
  return `${v.critical}c/${v.high}h/${v.moderate}m/${v.low}l`;
}

function statusColor(status) {
  switch (status) {
    case 'ok':
    case 'dry-run':
      return chalk.green;
    case 'up-to-date':
      return chalk.gray;
    case 'skipped-dirty':
      return chalk.yellow;
    case 'build-failed':
    case 'error':
      return chalk.red;
    default:
      return chalk.white;
  }
}

function pad(text, width, colorFn) {
  const padded = String(text).padEnd(width);
  return colorFn ? colorFn(padded) : padded;
}

export function printReport(results) {
  const cols = [
    { key: 'name', label: 'PROJECT', width: 28 },
    { key: 'vulns', label: 'VULNS (c/h/m/l)', width: 24 },
    { key: 'prodImpact', label: 'PROD-IMPACT', width: 12 },
    { key: 'buildChanged', label: 'BUILD Δ', width: 9 },
    { key: 'pushed', label: 'PUSHED', width: 8 },
    { key: 'syncProd', label: 'SYNC-PROD', width: 20 },
    { key: 'status', label: 'STATUS', width: 14 },
  ];

  const header = cols.map((c) => c.label.padEnd(c.width)).join(' ');
  console.log(`\n${chalk.bold(header)}`);
  console.log(chalk.gray('-'.repeat(header.length)));

  for (const r of results) {
    const vulns = r.vulnsAfter
      ? `${vulnStr(r.vulnsBefore)} -> ${vulnStr(r.vulnsAfter)}`
      : vulnStr(r.vulnsBefore ?? r.wouldFix);
    const prodImpactCount = r.remainingProdImpact?.length ?? 0;
    const row = [
      pad(r.name, cols[0].width),
      pad(vulns, cols[1].width),
      pad(prodImpactCount, cols[2].width, prodImpactCount ? chalk.yellow : chalk.gray),
      pad(r.buildChanged === true ? 'yes' : r.buildChanged === false ? 'no' : '-', cols[3].width, r.buildChanged ? chalk.green : chalk.gray),
      pad(r.pushed === true ? 'yes' : r.pushed === false ? 'no' : '-', cols[4].width, r.pushed ? chalk.green : chalk.gray),
      pad(r.syncProdStatus ?? '-', cols[5].width),
      pad(r.status, cols[6].width, statusColor(r.status)),
    ].join(' ');
    console.log(row);
  }

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(chalk.gray('-'.repeat(header.length)));
  console.log(
    Object.entries(counts)
      .map(([status, count]) => statusColor(status)(`${status}: ${count}`))
      .join('  '),
  );

  const needsFollowUp = results.filter((r) => r.status === 'build-failed' || r.status === 'error' || r.syncProdStatus === 'needs-manual-auth');
  if (needsFollowUp.length) {
    console.log(chalk.red.bold(`\n${needsFollowUp.length} project(s) need manual follow-up:`));
    for (const r of needsFollowUp) {
      console.log(chalk.red(`  - ${r.name}: ${r.error ?? r.syncProdStatus ?? r.status}`));
    }
  }
}
