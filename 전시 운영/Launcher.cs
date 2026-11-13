using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Launcher
{
#if TEST_PORT
    private const int Port = 8036;
#else
    private const int Port = 8026;
#endif
    private static readonly string Url = "http://127.0.0.1:" + Port + "/";
    private static readonly string Runtime = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "HZ_Portal_Exhibition");
    private static readonly string StatePath = Path.Combine(Runtime, "session.txt");

    private sealed class Identity
    {
        public int Pid;
        public long Started;
    }

    private sealed class Session
    {
        public string Root = "";
        public Identity Server;
        public Identity Browser;
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
#if STOP
            StopExhibition();
#else
            if (args.Length > 0 && args[0] == "--server")
            {
                if (args.Length < 2) return 1;
                RunServer(args[1]);
            }
            else StartExhibition();
#endif
            return 0;
        }
        catch (Exception error)
        {
#if !STOP
            if (args.Length > 0 && args[0] == "--server") return 1;
#endif
            MessageBox.Show(error.Message, "Exhibition", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static Identity Identify(Process process)
    {
        try
        {
            process.Refresh();
            return new Identity { Pid = process.Id, Started = process.StartTime.ToUniversalTime().Ticks };
        }
        catch { return null; }
    }

    private static bool IsRunning(Identity identity)
    {
        if (identity == null || identity.Pid <= 0 || identity.Started <= 0) return false;
        try
        {
            using (Process process = Process.GetProcessById(identity.Pid))
                return process.StartTime.ToUniversalTime().Ticks == identity.Started;
        }
        catch { return false; }
    }

    private static Session ReadSession()
    {
        Session session = new Session();
        try
        {
            string[] lines = File.ReadAllLines(StatePath, Encoding.UTF8);
            if (lines.Length != 5) return session;
            session.Root = lines[0];
            session.Server = new Identity { Pid = int.Parse(lines[1]), Started = long.Parse(lines[2]) };
            session.Browser = new Identity { Pid = int.Parse(lines[3]), Started = long.Parse(lines[4]) };
        }
        catch { return new Session(); }
        return session;
    }

    private static void SaveSession(Session session)
    {
        Directory.CreateDirectory(Runtime);
        File.WriteAllLines(StatePath, new[] {
            session.Root ?? "",
            session.Server == null ? "0" : session.Server.Pid.ToString(),
            session.Server == null ? "0" : session.Server.Started.ToString(),
            session.Browser == null ? "0" : session.Browser.Pid.ToString(),
            session.Browser == null ? "0" : session.Browser.Started.ToString()
        }, Encoding.UTF8);
    }

    private static void AddCandidate(List<string> candidates, string basePath, string suffix)
    {
        if (!string.IsNullOrEmpty(basePath)) candidates.Add(Path.Combine(basePath, suffix));
    }

    private static void AddRegistered(List<string> candidates, string name)
    {
        string key = @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + name;
        foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
        {
            try
            {
                using (RegistryKey app = hive.OpenSubKey(key))
                {
                    if (app != null)
                    {
                        string path = app.GetValue("") as string;
                        if (!string.IsNullOrEmpty(path)) candidates.Add(path.Trim('"'));
                    }
                }
            }
            catch { }
        }
    }

    private static string FindBrowser()
    {
        string programFiles = Environment.GetEnvironmentVariable("ProgramFiles");
        string programFiles86 = Environment.GetEnvironmentVariable("ProgramFiles(x86)");
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        List<string> candidates = new List<string>();
        AddCandidate(candidates, programFiles, @"Google\Chrome\Application\chrome.exe");
        AddCandidate(candidates, programFiles86, @"Google\Chrome\Application\chrome.exe");
        AddCandidate(candidates, local, @"Google\Chrome\Application\chrome.exe");
        AddRegistered(candidates, "chrome.exe");
        AddCandidate(candidates, programFiles86, @"Microsoft\Edge\Application\msedge.exe");
        AddCandidate(candidates, programFiles, @"Microsoft\Edge\Application\msedge.exe");
        AddRegistered(candidates, "msedge.exe");
        foreach (string candidate in candidates)
            if (File.Exists(candidate)) return candidate;
        return null;
    }

    private static bool PortIsOpen()
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                client.Connect(IPAddress.Loopback, Port);
                return true;
            }
        }
        catch { return false; }
    }

    private static bool ServerIsReady()
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Url);
            request.Method = "HEAD";
            request.Timeout = 1000;
            request.KeepAlive = false;
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                return response.StatusCode == HttpStatusCode.OK &&
                    response.Headers["X-Exhibition-Server"] == "1";
        }
        catch { return false; }
    }

    private static void StartExhibition()
    {
        string root = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar);
        string content = Path.Combine(root, "web");
        if (!File.Exists(Path.Combine(content, "index.html")))
            throw new Exception("Exhibition files are missing. Extract the entire folder before starting.");
        string browser = FindBrowser();
        if (browser == null)
            throw new Exception("Install Google Chrome or Microsoft Edge on this computer.");

        Session session = ReadSession();
        if (IsRunning(session.Server) &&
            !string.Equals(session.Root, root, StringComparison.OrdinalIgnoreCase))
            throw new Exception("Another exhibition folder is already running. Run its Stop file first.");

        bool startedServer = false;
        if (!IsRunning(session.Server))
        {
            if (PortIsOpen())
                throw new Exception("Port 8026 is in use. Close the other local server first.");
            ProcessStartInfo serverInfo = new ProcessStartInfo(
                Assembly.GetExecutingAssembly().Location,
                "--server " + Quote(content));
            serverInfo.UseShellExecute = false;
            serverInfo.CreateNoWindow = true;
            serverInfo.WindowStyle = ProcessWindowStyle.Hidden;
            serverInfo.WorkingDirectory = root;
            using (Process process = Process.Start(serverInfo))
            {
                Thread.Sleep(100);
                session.Server = Identify(process);
            }
            if (session.Server == null)
                throw new Exception("The local exhibition server could not start.");
            session.Root = root;
            session.Browser = null;
            SaveSession(session);
            startedServer = true;
            bool ready = false;
            for (int i = 0; i < 40; i++)
            {
                if (ServerIsReady()) { ready = true; break; }
                if (!IsRunning(session.Server)) break;
                Thread.Sleep(200);
            }
            if (!ready)
            {
                Kill(session.Server);
                if (File.Exists(StatePath)) File.Delete(StatePath);
                throw new Exception("The local exhibition server could not open port 8026.");
            }
        }
        else if (!ServerIsReady())
            throw new Exception("The exhibition server is running but is not responding.");

        if (!IsRunning(session.Browser))
        {
            string profileName = Path.GetFileName(browser).Equals(
                "chrome.exe", StringComparison.OrdinalIgnoreCase)
                ? "ChromeProfile" : "EdgeProfile";
            string profile = Path.Combine(Runtime, profileName);
            Directory.CreateDirectory(profile);
            ProcessStartInfo browserInfo = new ProcessStartInfo(
                browser,
                "--user-data-dir=" + Quote(profile) +
                " --no-first-run --disable-session-crashed-bubble --start-maximized --app=" + Url);
            browserInfo.UseShellExecute = false;
            browserInfo.WorkingDirectory = root;
            try
            {
                using (Process process = Process.Start(browserInfo))
                {
                    Thread.Sleep(350);
                    session.Browser = Identify(process);
                }
                if (session.Browser == null)
                    throw new Exception("The exhibition browser could not start.");
                SaveSession(session);
            }
            catch
            {
                if (startedServer) Kill(session.Server);
                if (File.Exists(StatePath)) File.Delete(StatePath);
                throw;
            }
        }
    }

    private static string Quote(string value) { return "\"" + value + "\""; }

    private static void Kill(Identity identity)
    {
        if (!IsRunning(identity)) return;
        try
        {
            using (Process process = Process.GetProcessById(identity.Pid))
                process.Kill();
        }
        catch { }
    }

    private static void KillTree(Identity identity)
    {
        if (!IsRunning(identity)) return;
        try
        {
            ProcessStartInfo info = new ProcessStartInfo("taskkill.exe",
                "/PID " + identity.Pid + " /T /F");
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;
            using (Process process = Process.Start(info)) process.WaitForExit(10000);
        }
        catch { }
    }

    private static void StopExhibition()
    {
        Session session = ReadSession();
        KillTree(session.Browser);
        Kill(session.Server);
        try { if (File.Exists(StatePath)) File.Delete(StatePath); } catch { }
    }

    private static void RunServer(string contentRoot)
    {
        string root = Path.GetFullPath(contentRoot).TrimEnd(Path.DirectorySeparatorChar);
        TcpListener listener = new TcpListener(IPAddress.Loopback, Port);
        listener.Start();
        try
        {
            while (true)
            {
                TcpClient client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(delegate(object value) {
                    ServeClient((TcpClient)value, root);
                }, client);
            }
        }
        finally { listener.Stop(); }
    }

    private static void ServeClient(TcpClient client, string root)
    {
        using (client)
        {
            try
            {
                client.ReceiveTimeout = 5000;
                client.SendTimeout = 30000;
                NetworkStream stream = client.GetStream();
                StreamReader reader = new StreamReader(stream, Encoding.ASCII);
                string first = reader.ReadLine();
                if (string.IsNullOrEmpty(first)) return;
                for (int i = 0; i < 100; i++)
                {
                    string line = reader.ReadLine();
                    if (string.IsNullOrEmpty(line)) break;
                }
                string[] parts = first.Split(' ');
                string method = parts[0];
                string status = "200 OK";
                string file = null;
                if (parts.Length < 2 || (method != "GET" && method != "HEAD"))
                    status = "405 Method Not Allowed";
                else
                {
                    try
                    {
                        string relative = parts[1].Split('?')[0];
                        relative = Uri.UnescapeDataString(relative).TrimStart('/', '\\');
                        if (relative.Length == 0) relative = "index.html";
                        relative = relative.Replace('/', Path.DirectorySeparatorChar);
                        file = Path.GetFullPath(Path.Combine(root, relative));
                        if (!file.StartsWith(root + Path.DirectorySeparatorChar,
                            StringComparison.OrdinalIgnoreCase))
                            status = "403 Forbidden";
                        else if (!File.Exists(file))
                            status = "404 Not Found";
                        else if (Mime(file) == null)
                            status = "403 Forbidden";
                    }
                    catch { status = "400 Bad Request"; }
                }
                long length = status == "200 OK" ? new FileInfo(file).Length : 0;
                string type = status == "200 OK" ? Mime(file) : "text/plain; charset=utf-8";
                string headers = "HTTP/1.1 " + status + "\r\n" +
                    "Content-Length: " + length + "\r\n" +
                    "Content-Type: " + type + "\r\n" +
                    "Cache-Control: no-cache\r\n" +
                    "X-Content-Type-Options: nosniff\r\n" +
                    "X-Exhibition-Server: 1\r\n" +
                    "Connection: close\r\n\r\n";
                byte[] bytes = Encoding.ASCII.GetBytes(headers);
                stream.Write(bytes, 0, bytes.Length);
                if (status == "200 OK" && method == "GET")
                {
                    using (FileStream source = File.OpenRead(file)) source.CopyTo(stream);
                }
                stream.Flush();
            }
            catch { }
        }
    }

    private static string Mime(string file)
    {
        switch (Path.GetExtension(file).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".mjs":
            case ".js": return "text/javascript; charset=utf-8";
            case ".wasm": return "application/wasm";
            case ".woff2": return "font/woff2";
            case ".png": return "image/png";
            case ".jpg":
            case ".jpeg": return "image/jpeg";
            case ".webp": return "image/webp";
            case ".svg": return "image/svg+xml";
            case ".ogg": return "audio/ogg";
            case ".mp3": return "audio/mpeg";
            case ".task": return "application/octet-stream";
            case ".json": return "application/json";
            case ".txt": return "text/plain; charset=utf-8";
            default: return null;
        }
    }
}
