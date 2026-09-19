# The App Clip's measuring flow, compiled into the Zinevu app itself.
#
# `Shared/` holds SYMLINKS to targets/ar-clip — the clip target and this pod
# build the very same Swift, so there is one measuring experience to fix and
# not two to keep in step. The clip's `@main` entry point is deliberately not
# linked here. See ArMeasureModule.swift for why the app needs it at all.
Pod::Spec.new do |s|
  s.name           = 'ArMeasure'
  s.version        = '1.0.0'
  s.summary        = 'Veranda measurement with ARKit, shared with the App Clip'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Zinevu'
  s.homepage       = 'https://zinevu.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/burakkilinc-pa/zinevu-mobile.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ARKit', 'RealityKit'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
