import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = execFileSync(
  "git",
  ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
);
const paths = output.split("\0").filter(Boolean).sort();
const errors = [];

const sensitivePathPatterns = [
  /(^|\/)(?:northstar-data|attachments|backups|exports|logs)(?:\/|$)/i,
  /(?:^|\/)(?:\.env(?!\.example$)|\.DS_Store)$/i,
  /\.(?:sqlite3?|db)(?:-(?:shm|wal))?$/i,
  /\.(?:pem|key|p12|pfx|mobileprovision)$/i,
  /(?:^|\/)northstar-(?:export|backup)(?:[./-]|$)/i,
];

const secretPatterns = [
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["openai_key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["github_token", /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["aws_access_key", /\bAKIA[A-Z0-9]{16}\b/],
  ["slack_token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["personal_path", /(?:\/Users\/[A-Za-z0-9._-]+(?:\/|$)|\/home\/[A-Za-z0-9._-]+(?:\/|$)|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+(?:\\|$)|\/private\/var\/folders\/)/],
  ["personal_email", /\b(?![0-9+A-Za-z._-]+@users\.noreply\.github\.com\b)[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
];

for (const path of paths) {
  if (sensitivePathPatterns.some((pattern) => pattern.test(path))) {
    errors.push(`sensitive_path:${path}`);
    continue;
  }
  const absolute = resolve(root, path);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    errors.push(`symlink_not_allowed:${path}`);
    continue;
  }
  if (!stat.isFile()) continue;
  if (stat.size > 5 * 1024 * 1024) {
    errors.push(`file_too_large:${path}:${stat.size}`);
    continue;
  }
  const data = readFileSync(absolute);
  if (data.includes(0)) {
    errors.push(`binary_file_not_reviewed:${path}`);
    continue;
  }
  const text = data.toString("utf8");
  for (const [name, pattern] of secretPatterns) {
    if (pattern.test(text)) errors.push(`${name}:${path}`);
  }
}

if (errors.length) {
  console.error("Public-tree check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Public-tree check passed (${paths.length} files).`);
