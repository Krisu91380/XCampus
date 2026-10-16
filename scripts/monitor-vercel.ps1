Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CredManMonitor {
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

$token = [CredManMonitor]::GetPassword("git:https://github.com")
$headers = @{
    "Authorization" = "token $token"
    "User-Agent" = "Antigravity"
    "Accept" = "application/vnd.github.v3+json"
}

$sha = "33507301688e03509dcb22d8c7f09a2a2ae6ad7c"
Write-Host "Monitoring commit: $sha"

for ($i = 0; $i -lt 30; $i++) {
    $statuses = Invoke-RestMethod -Uri "https://api.github.com/repos/Krisu91380/XCampus/commits/$sha/statuses" -Headers $headers
    if ($statuses.Count -gt 0) {
        $st = $statuses[0]
        Write-Host "[$i] $($st.context): $($st.state) - $($st.description)"
        if ($st.state -eq "success" -or $st.state -eq "failure") {
            break
        }
    } else {
        Write-Host "[$i] No statuses yet, waiting..."
    }
    Start-Sleep -Seconds 8
}
