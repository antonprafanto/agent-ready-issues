# Ranked Reporter Question Bank (Bilingual EN / ID)

When an issue's Agent Readiness Score is below 75, select at most **3 questions** targeting the lowest-scoring dimensions. Keep technical identifiers (`Response`, `Console.print`, HTTP routes, function names) verbatim in English even when replying in Indonesian, matching the empirical finding from *Lingua-SWE-129* that code-mixed Indonesian preserves 100% of coding-agent accuracy when identifiers remain in English.

## 1. Missing Expected Behavioral Contract (`expectedVsActual`)
- **EN:** "To make sure our fix matches what you need: when `[trigger action]` happens, what exact output, return value, or UI state did you expect instead of `[observed symptom]`?"
- **ID:** "Agar perbaikan sesuai kebutuhan Anda: saat `[trigger action]` dijalankan, hasil/output atau tampilan apa yang seharusnya muncul menggantikan `[observed symptom]`?"

## 2. Missing Reproduction Steps or Input Payload (`reproSteps`)
- **EN:** "Could you share a minimal snippet, input payload, or the exact 2–3 steps you took right before `[observed symptom]` occurred?"
- **ID:** "Boleh dibagikan contoh kode singkat, input data, atau 2–3 langkah terakhir sebelum kendala `[observed symptom]` muncul?"

## 3. Missing Error Message or Traceback (`environmentContext`)
- **EN:** "Did you see an error message, HTTP status code, or console traceback when this failed? Pasting the exact error line helps us pinpoint the function immediately."
- **ID:** "Apakah muncul pesan error, kode status HTTP, atau traceback di console saat gagal? Menyalin baris error tersebut akan sangat membantu kami menemukan fungsinya."

## 4. Ambiguous Edge-Case Policy (`acceptanceCriteria`)
- **EN:** "If `[edge case condition]` occurs (for example, an empty list or `None` value), should the system raise a validation error or fall back to `[default behavior]`?"
- **ID:** "Jika kondisi `[edge case condition]` terjadi (misalnya nilai kosong/`None`), apakah sistem sebaiknya menampilkan pesan error validasi atau kembali ke default `[default behavior]`?"
