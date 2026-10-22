// 클라우드 백엔드 약속(10/22): Dropbox와 Google Drive가 같은 이름·같은 동작으로 갖춰야 하는 기능 묶음.
// 저장소(unified-storage)는 이 이름만 부르고 어느 클라우드인지는 모른다. 묶음이 빠지면 그 기능만 '지원 안 함'으로 보인다.
export const BACKEND_FEATURES=Object.freeze({
 core:Object.freeze(['connect','disconnect','list','exists','load','identity','prepareFolders','createOnly']), // 연결 · 7개 데이터 읽기 · 첫 준비
 save:Object.freeze(['updateDataset']),                                   // 조건부 저장(그 사이 바뀌었으면 거절) · 끊김 확인
 purchases:Object.freeze(['purchasesIdentity','loadPurchases','createPurchases']), // 매입 파일(없으면 '시작 전')
 log:Object.freeze(['readLog','appendLog']),                              // 변경 기록(월별 파일, 더하기만)
 assets:Object.freeze(['uploadAsset','downloadAsset']),                   // 사진·문서
 session:Object.freeze(['session']),                                      // 남은 연결 시간(로그인 유지 띠)
 backups:Object.freeze(['listBackups','createBackup','readBackup'])      // 매일 자동 백업(NARO Biz/Backups/YYYY-MM-DD.json, 만들기만)
});
export function backendFeatures(backend){
 return Object.fromEntries(Object.entries(BACKEND_FEATURES).map(([name,methods])=>[name,methods.every(m=>typeof backend?.[m]==='function')]));
}
