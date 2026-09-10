#!/usr/bin/env ruby
# Generates NeedleHost.xcodeproj for the ios-host example.
# Requires the xcodeproj gem (ships with CocoaPods). Run: ruby generate-project.rb
require 'xcodeproj'

PROJECT_PATH = File.expand_path('NeedleHost.xcodeproj', __dir__)
SOURCES_DIR = File.expand_path('NeedleHost', __dir__)

if File.exist?(PROJECT_PATH)
  puts "NeedleHost.xcodeproj already exists; delete it first to regenerate."
  exit 0
end

project = Xcodeproj::Project.new(PROJECT_PATH)

target = project.new_target(:application, 'NeedleHost', :ios, '12.0')

# Source group mirroring the NeedleHost/ directory.
group = project.main_group.new_group('NeedleHost', 'NeedleHost')
%w[AppDelegate.h AppDelegate.mm ViewController.h ViewController.mm main.m Info.plist].each do |f|
  ref = group.new_file(f)
  target.add_file_references([ref]) if f.end_with?('.m', '.mm')
end

bundle_ref = project.main_group.new_file('../lynx-needle-demo/dist/main.lynx.bundle')
target.resources_build_phase.add_file_reference(bundle_ref)

target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.lynxneedle.host'
  config.build_settings['INFOPLIST_FILE'] = 'NeedleHost/Info.plist'
  config.build_settings['PRODUCT_NAME'] = 'NeedleHost'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
  config.build_settings['CLANG_ENABLE_OBJC_ARC'] = 'YES'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['MARKETING_VERSION'] = '0.1.0'
  # CocoaPods injects its own xcconfig after `pod install`; the base
  # configuration reference is wired by the generated workspace.
end

project.save
puts "Generated #{PROJECT_PATH}"
puts "Next: pod install && open NeedleHost.xcworkspace"
