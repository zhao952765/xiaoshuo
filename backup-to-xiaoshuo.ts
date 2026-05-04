import * as fs from 'fs';
import * as path from 'path';

// 源目录和目标目录
const sourceDir = '.';
const destDir = './xiaoshuo';

// 需要备份的文件和目录列表
const backupItems = [
  '.gitignore',
  '.npmrc',
  'LICENSE',
  'README.md',
  'assets',
  'electron',
  'eslint.config.js',
  'index.html',
  'package-lock.json',
  'package.json',
  'public',
  'src',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts'
];

/**
 * 复制文件或目录
 * @param src 源路径
 * @param dest 目标路径
 */
function copyFileSync(src: string, dest: string) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    // 如果源是目录
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      copyFileSync(srcPath, destPath);
    }
  } else {
    // 如果源是文件
    fs.copyFileSync(src, dest);
  }
}

/**
 * 清空目标目录
 * @param dir 目标目录
 */
function clearDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      clearDirectory(itemPath);
      fs.rmdirSync(itemPath);
    } else {
      fs.unlinkSync(itemPath);
    }
  }
}

console.log('开始备份项目文件到 xiaoshuo 目录...');

try {
  // 清空目标目录内容
  clearDirectory(destDir);
  
  // 复制每个项目
  for (const item of backupItems) {
    const srcPath = path.join(sourceDir, item);
    const destPath = path.join(destDir, item);
    
    if (fs.existsSync(srcPath)) {
      console.log(`正在复制: ${item}`);
      copyFileSync(srcPath, destPath);
    } else {
      console.warn(`警告: ${srcPath} 不存在，跳过`);
    }
  }
  
  console.log('备份完成！');
  console.log(`文件已备份到: ${path.resolve(destDir)}`);
} catch (error) {
  console.error('备份过程中出现错误:', error);
}