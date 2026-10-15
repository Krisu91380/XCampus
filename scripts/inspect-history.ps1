Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CredMan2 {
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }
    public static string GetPassword(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] b = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, b, 0, cred.CredentialBlobSize);
            return System.Text.Encoding.Unicode.GetString(b);
        }
        return null;
    }
}
"@

$token = [CredMan2]::GetPassword("git:https://github.com")
$headers = @{
    "Authorization" = "token $token"
    "User-Agent" = "Antigravity"
    "Accept" = "application/vnd.github.v3+json"
}

$commits = Invoke-RestMethod -Uri "https://api.github.com/repos/Krisu91380/XCampus/commits?per_page=10" -Headers $headers
foreach ($c in $commits) {
    $sha = $c.sha.Substring(0, 7)
    $msg = $c.commit.message.Split("`n")[0]
    $statuses = Invoke-RestMethod -Uri "https://api.github.com/repos/Krisu91380/XCampus/commits/$($c.sha)/statuses" -Headers $headers
    $st = if ($statuses.Count -gt 0) { "$($statuses[0].state): $($statuses[0].description)" } else { "none" }
    Write-Host "$sha | $st | $msg"
}
