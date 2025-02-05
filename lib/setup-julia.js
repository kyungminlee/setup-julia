"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// Store information about the environment
const osPlat = os.platform(); // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`);
function getMajorMinorVersion(version) {
    return version.split('.').slice(0, 2).join('.');
}
function getDownloadURL(version, arch) {
    const baseURL = 'https://julialang-s3.julialang.org/bin';
    let platform;
    const versionDir = getMajorMinorVersion(version);
    if (osPlat === 'win32') { // Windows
        platform = 'winnt';
    }
    else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw '32-bit Julia is not available on macOS';
        }
        platform = 'mac';
    }
    else if (osPlat === 'linux') { // Linux
        platform = 'linux';
    }
    else {
        throw `Platform ${osPlat} is not supported`;
    }
    return `${baseURL}/${platform}/${arch}/${versionDir}/${getFileName(version, arch)}`;
}
function getFileName(version, arch) {
    let versionExt, ext;
    if (osPlat === 'win32') { // Windows
        versionExt = arch == 'x64' ? '-win64' : '-win32';
        ext = 'exe';
    }
    else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw '32-bit Julia is not available on macOS';
        }
        versionExt = '-mac64';
        ext = 'dmg';
    }
    else if (osPlat === 'linux') { // Linux
        versionExt = arch == 'x64' ? '-linux-x86_64' : '-linux-i686';
        ext = 'tar.gz';
    }
    else {
        throw `Platform ${osPlat} is not supported`;
    }
    return `julia-${version}${versionExt}.${ext}`;
}
function installJulia(version, arch) {
    return __awaiter(this, void 0, void 0, function* () {
        // Download Julia
        const downloadURL = getDownloadURL(version, arch);
        core.debug(`downloading Julia from ${downloadURL}`);
        const juliaDownloadPath = yield tc.downloadTool(downloadURL);
        // Install it
        switch (osPlat) {
            case 'linux':
                const juliaExtractedFolder = yield tc.extractTar(juliaDownloadPath);
                return path.join(juliaExtractedFolder, `julia-${version}`);
            case 'win32':
                const juliaInstallationPath = path.join('C:', 'Julia');
                yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${juliaInstallationPath}" -NoNewWindow -Wait`]);
                return juliaInstallationPath;
            case 'darwin':
                yield exec.exec('hdiutil', ['attach', juliaDownloadPath]);
                return `/Volumes/Julia-${version}/Julia-${getMajorMinorVersion(version)}.app/Contents/Resources/julia`;
            default:
                throw `Platform ${osPlat} is not supported`;
        }
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const version = core.getInput('julia-version');
            const arch = core.getInput('arch');
            core.debug(`selected Julia version: ${arch}/${version}`);
            // Search in cache
            let juliaPath;
            juliaPath = tc.find('julia', version, arch);
            if (!juliaPath) {
                core.debug(`could not find Julia ${version} in cache`);
                const juliaInstallationPath = yield installJulia(version, arch);
                // Add it to cache
                juliaPath = yield tc.cacheDir(juliaInstallationPath, 'julia', version, arch);
                core.debug(`added Julia to cache: ${juliaPath}`);
            }
            else {
                core.debug(`using cached version of Julia: ${juliaPath}`);
            }
            // Add it to PATH
            core.addPath(path.join(juliaPath, 'bin'));
            // Test if Julia has been installed by showing versioninfo()
            yield exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()']);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
