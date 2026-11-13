import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../services/storage_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final StorageService _storage = StorageService();

  // حقول Xtream Codes
  final _xtreamNameCtrl = TextEditingController(text: 'My IPTV');
  final _serverCtrl = TextEditingController();
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscurePass = true;

  // حقول M3U
  final _m3uNameCtrl = TextEditingController(text: 'M3U Playlist');
  final _m3uUrlCtrl = TextEditingController();
  final _epgUrlCtrl = TextEditingController();
  String? _localFilePath;
  String? _localFileName;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _prefillSavedData();
  }

  Future<void> _prefillSavedData() async {
    final source = await _storage.getActiveSource();
    if (source == null) return;
    setState(() {
      if (source['type'] == 'xtream') {
        _tabController.index = 0;
        _xtreamNameCtrl.text = source['name'] ?? 'My IPTV';
        _serverCtrl.text = source['server'] ?? '';
        _userCtrl.text = source['username'] ?? '';
        _passCtrl.text = source['password'] ?? '';
      } else {
        _tabController.index = 1;
        _m3uNameCtrl.text = source['name'] ?? 'M3U Playlist';
        _m3uUrlCtrl.text = source['m3uUrl'] ?? '';
        _epgUrlCtrl.text = source['epgUrl'] ?? '';
        _localFilePath = source['filePath'];
        _localFileName = source['fileName'];
      }
    });
  }

  Future<void> _submitXtream() async {
    final server = _serverCtrl.text.trim();
    final user = _userCtrl.text.trim();
    final pass = _passCtrl.text.trim();

    if (server.isEmpty || user.isEmpty || pass.isEmpty) {
      _showMsg('عافاك عمر جميع خانات Xtream Codes');
      return;
    }

    final cleanServer =
        server.endsWith('/') ? server.substring(0, server.length - 1) : server;
    final fullServer =
        cleanServer.startsWith('http') ? cleanServer : 'http://$cleanServer';

    await _storage.saveActiveSource({
      'type': 'xtream',
      'name': _xtreamNameCtrl.text.trim().isEmpty
          ? 'Xtream IPTV'
          : _xtreamNameCtrl.text.trim(),
      'server': fullServer,
      'username': user,
      'password': pass,
      'epgUrl': '$fullServer/xmltv.php?username=$user&password=$pass',
    });

    _goToHome();
  }

  Future<void> _pickLocalM3uFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['m3u', 'm3u8', 'txt'],
    );
    if (result != null && result.files.single.path != null) {
      setState(() {
        _localFilePath = result.files.single.path;
        _localFileName = result.files.single.name;
        _m3uUrlCtrl.clear();
      });
    }
  }

  Future<void> _submitM3u() async {
    final url = _m3uUrlCtrl.text.trim();
    if (url.isEmpty && _localFilePath == null) {
      _showMsg('حط رابط M3U أو اختار ملف من الهاتف');
      return;
    }

    await _storage.saveActiveSource({
      'type': _localFilePath != null ? 'file' : 'm3u',
      'name': _m3uNameCtrl.text.trim().isEmpty
          ? 'M3U Playlist'
          : _m3uNameCtrl.text.trim(),
      'm3uUrl': url,
      'filePath': _localFilePath ?? '',
      'fileName': _localFileName ?? '',
      'epgUrl': _epgUrlCtrl.text.trim(),
    });

    _goToHome();
  }

  void _goToHome() {
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  void _showMsg(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _xtreamNameCtrl.dispose();
    _serverCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    _m3uNameCtrl.dispose();
    _m3uUrlCtrl.dispose();
    _epgUrlCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
            const Icon(Icons.play_circle_fill, size: 64, color: Colors.amber),
            const SizedBox(height: 8),
            const Text(
              'Z8 PLAYER',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
                letterSpacing: 2,
              ),
            ),
            const Text(
              'اختر طريقة تشغيل القنوات والأفلام',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 20),
            TabBar(
              controller: _tabController,
              indicatorColor: Colors.amber,
              labelColor: Colors.amber,
              unselectedLabelColor: Colors.grey,
              tabs: const [
                Tab(icon: Icon(Icons.dns), text: 'Xtream Codes'),
                Tab(icon: Icon(Icons.link), text: 'رابط / ملف M3U'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // --- تبويب Xtream Codes ---
                  ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      TextField(
                        controller: _xtreamNameCtrl,
                        decoration: const InputDecoration(
                          labelText: 'اسم القائمة (اختياري)',
                          prefixIcon: Icon(Icons.label_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _serverCtrl,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          labelText: 'Server URL (مثال: http://line.xyz:8080)',
                          prefixIcon: Icon(Icons.language),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _userCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Username (اسم المستخدم)',
                          prefixIcon: Icon(Icons.person_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _passCtrl,
                        obscureText: _obscurePass,
                        decoration: InputDecoration(
                          labelText: 'Password (كلمة المرور)',
                          prefixIcon: const Icon(Icons.lock_outline),
                          border: const OutlineInputBorder(),
                          suffixIcon: IconButton(
                            icon: Icon(_obscurePass
                                ? Icons.visibility
                                : Icons.visibility_off),
                            onPressed: () =>
                                setState(() => _obscurePass = !_obscurePass),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        height: 50,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber,
                            foregroundColor: Colors.black,
                          ),
                          icon: const Icon(Icons.login),
                          label: const Text(
                            'تسجيل الدخول وتحميل الباقة',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          onPressed: _submitXtream,
                        ),
                      ),
                    ],
                  ),

                  // --- تبويب M3U / M3U8 ---
                  ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      TextField(
                        controller: _m3uNameCtrl,
                        decoration: const InputDecoration(
                          labelText: 'اسم القائمة',
                          prefixIcon: Icon(Icons.label_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _m3uUrlCtrl,
                        keyboardType: TextInputType.url,
                        onChanged: (_) {
                          if (_localFilePath != null) {
                            setState(() {
                              _localFilePath = null;
                              _localFileName = null;
                            });
                          }
                        },
                        decoration: const InputDecoration(
                          labelText: 'رابط M3U أو M3U8',
                          prefixIcon: Icon(Icons.link),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.folder_open),
                        label: Text(_localFileName ??
                            'أو اختر ملف M3U من ذاكرة الهاتف'),
                        onPressed: _pickLocalM3uFile,
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _epgUrlCtrl,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          labelText: 'رابط دليل البرامج EPG XMLTV (اختياري)',
                          prefixIcon: Icon(Icons.calendar_today),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        height: 50,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber,
                            foregroundColor: Colors.black,
                          ),
                          icon: const Icon(Icons.play_arrow),
                          label: const Text(
                            'تشغيل القائمة',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          onPressed: _submitM3u,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
