Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CredMan {
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

$token = [CredMan]::GetPassword("git:https://github.com")
$headers = @{
    "Authorization" = "token $token"
    "User-Agent" = "Antigravity"
    "Accept" = "application/vnd.github.v3+json"
}

$commitSha = "cf38ef8e6f20ab30f3403f3a2495506166358161"
$statuses = Invoke-RestMethod -Uri "https://api.github.com/repos/Krisu91380/XCampus/commits/$commitSha/statuses" -Headers $headers
$statuses | ForEach-Object {
    Write-Host "===================="
    Write-Host "Context: $($_.context)"
    Write-Host "State: $($_.state)"
    Write-Host "Description: $($_.description)"
    Write-Host "Target URL: $($_.target_url)"
}
