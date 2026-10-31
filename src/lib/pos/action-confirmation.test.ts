import { afterEach, expect, it, vi } from "vitest";
import { confirmedAction } from "./action-confirmation";
afterEach(() => vi.unstubAllGlobals());
it("menolak konfirmasi tidak menjalankan perubahan atau efek samping", () => {
 vi.stubGlobal("window", { confirm: () => false });
 const action = vi.fn();
 confirmedAction("Simpan?", action);
 expect(action).not.toHaveBeenCalled();
});
it("konfirmasi menjalankan aksi tepat sekali tanpa dialog ganda untuk helper", () => {
 const confirm = vi.fn(() => true); vi.stubGlobal("window", { confirm });
 const action = vi.fn();
 confirmedAction("Simpan?", () => confirmedAction("Simpan?", action));
 expect(action).toHaveBeenCalledTimes(1); expect(confirm).toHaveBeenCalledTimes(1);
});
