/**
 * PDF Compile Service (Phase 12.1)
 *
 * Goal:
 * - Provide a stable backend API to compile LaTeX -> PDF.
 * - Allow swapping the underlying compiler via env var without changing the API:
 *   PDF_COMPILER=tectonic|texlive
 *
 * Notes:
 * - For now we depend on a system-installed compiler binary.
 * - If the binary is missing, we fail with a clear error (no silent fallbacks).
 */

import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type PdfCompilerKind = 'tectonic' | 'texlive';

export class PdfCompileService {
  getCompilerKind(): PdfCompilerKind {
    const raw = String(process.env.PDF_COMPILER ?? 'tectonic').toLowerCase().trim();
    if (raw === 'texlive' || raw === 'latexmk') return 'texlive';
    return 'tectonic';
  }

  async compileLatexToPdf(params: { latex: string; jobName?: string }): Promise<Buffer> {
    const latex = String(params.latex ?? '');
    const jobName = (params.jobName ?? 'main').replace(/[^a-zA-Z0-9_-]+/g, '_');

    if (latex.trim().length === 0) {
      throw new Error('LaTeX content is empty');
    }

    const workDir = await mkdtemp(path.join(tmpdir(), 'zadoox-pdf-'));
    const texPath = path.join(workDir, `${jobName}.tex`);
    const pdfPath = path.join(workDir, `${jobName}.pdf`);

    try {
      await writeFile(texPath, latex, 'utf8');

      const kind = this.getCompilerKind();
      if (kind === 'tectonic') {
        await this.runCmd({
          cmd: 'tectonic',
          args: [
            '--outdir',
            workDir,
            '--synctex',
            '--keep-logs',
            `${jobName}.tex`,
          ],
          cwd: workDir,
        });
      } else {
        // TeX Live + latexmk
        await this.runCmd({
          cmd: 'latexmk',
          args: [
            '-pdf',
            '-interaction=nonstopmode',
            '-halt-on-error',
            `-outdir=${workDir}`,
            `${jobName}.tex`,
          ],
          cwd: workDir,
        });
      }

      const pdf = await readFile(pdfPath);
      if (!pdf || pdf.length === 0) {
        throw new Error('PDF generation failed (empty output)');
      }
      return pdf;
    } finally {
      // Best-effort cleanup
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private runCmd(params: { cmd: string; args: string[]; cwd: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(params.cmd, params.args, {
        cwd: params.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += String(d)));
      child.stderr.on('data', (d) => (stderr += String(d)));

      child.on('error', (err) => {
        // Typically: ENOENT (binary not installed)
        reject(new Error(`Failed to run ${params.cmd}: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) return resolve();
        reject(
          new Error(
            `${params.cmd} failed (exit ${code}).\n${stderr.trim() || stdout.trim() || 'No output'}`
          )
        );
      });
    });
  }
}


